import { ipcMain, shell } from 'electron'
import { createHash } from 'crypto'
import { basename, dirname, extname, join, resolve, sep } from 'path'
import {
  statSync,
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  renameSync,
  rmSync
} from 'fs'
import { IpcChannels } from '../../shared/ipc-channels'
import { LibraryService } from '../services/library.service'
import { FfmpegService } from '../services/ffmpeg.service'
import { MusicBrainzService } from '../services/musicbrainz.service'
import { SettingsService } from '../services/settings.service'
import { sanitizeFilename, buildM3U } from '../../shared/utils'
import type { Track, Device } from '../../shared/models'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const AUDIO_EXT = new Set(['.mp3', '.flac', '.opus', '.m4a', '.wav', '.ogg', '.aac'])

function walkAudio(p: string): string[] {
  try {
    const st = statSync(p)
    if (st.isDirectory()) return readdirSync(p).flatMap((f) => walkAudio(join(p, f)))
    return AUDIO_EXT.has(extname(p).toLowerCase()) ? [p] : []
  } catch {
    return []
  }
}

type MbMeta = { genre: string | null; coverUrl: string | null; mbArtist: string | null }

// Shared MB resolution: cache hit returns immediately; cache miss looks up genre +
// cover art, caches it, and rate-limits to ~1 req/sec.
async function lookupMetaCached(
  mb: MusicBrainzService,
  cache: Map<string, MbMeta>,
  artist: string,
  title: string
): Promise<MbMeta> {
  const key = `${artist} ${title}`
  const hit = cache.get(key)
  if (hit) return hit
  const meta = await mb.lookupMetadata(artist, title)
  cache.set(key, meta)
  await delay(1100)
  return meta
}

export function registerLibraryIpc(): void {
  const library = new LibraryService()

  ipcMain.handle(IpcChannels.LIBRARY_GET, async () => {
    return library.load()
  })

  ipcMain.handle(IpcChannels.LIBRARY_GET_TRACK_PATH, async (_event, trackId: string) => {
    const data = library.load()
    for (const pl of data.playlists) {
      const track = pl.tracks.find((t) => t.id === trackId)
      if (track?.filePath) return track.filePath
    }
    return null
  })

  ipcMain.handle(IpcChannels.LIBRARY_DELETE_TRACKS, async (_event, trackIds: string[]) => {
    if (!Array.isArray(trackIds)) throw new Error('trackIds must be an array')
    library.deleteTracks(trackIds)
  })

  ipcMain.handle(IpcChannels.LIBRARY_MOVE_TRACKS, async (_event, trackIds: string[], targetPlaylistId: string) => {
    if (!Array.isArray(trackIds) || !trackIds.length) throw new Error('trackIds must be a non-empty array')
    if (!targetPlaylistId) throw new Error('targetPlaylistId required')
    library.moveTracks(trackIds, targetPlaylistId)
  })

  ipcMain.handle(IpcChannels.LIBRARY_RENAME_PLAYLIST, async (_event, playlistId: string, newTitle: string) => {
    library.renamePlaylist(playlistId, newTitle)
  })

  ipcMain.handle(
    IpcChannels.LIBRARY_SET_METADATA,
    async (_event, trackIds: string[], patch: { title?: string; artist?: string; genre?: string }) => {
      if (!Array.isArray(trackIds) || !trackIds.length) throw new Error('trackIds must be a non-empty array')
      const updated = library.setTrackMetadata(trackIds, patch)
      const ffmpeg = new FfmpegService()
      let tagged = 0
      for (const t of updated) {
        if (t.filePath && existsSync(t.filePath)) {
          try {
            // Re-tag the file with the changed fields (using each track's final values).
            const fileTags: { title?: string; artist?: string; genre?: string } = {}
            if (patch.title !== undefined) fileTags.title = t.title
            if (patch.artist !== undefined) fileTags.artist = t.artist
            if (patch.genre !== undefined) fileTags.genre = t.genre ?? ''
            await ffmpeg.setTags(t.filePath, fileTags)
            tagged++
          } catch {
            /* non-fatal: library is already updated */
          }
        }
      }
      return { updated: updated.length, tagged }
    }
  )

  ipcMain.handle(IpcChannels.LIBRARY_DELETE_ALL, async () => {
    library.deleteAll()
  })

  ipcMain.handle(IpcChannels.LIBRARY_VERIFY, async () => {
    return library.verify()
  })

  ipcMain.handle(IpcChannels.LIBRARY_GET_PLAYLIST_INFO_PATH, async (_event, playlistId: string) => {
    const data = library.load()
    const pl = data.playlists.find((p) => p.id === playlistId)
    if (!pl) return null
    const firstTrack = pl.tracks.find((t) => t.filePath)
    if (!firstTrack) return null
    const infoFile = join(dirname(firstTrack.filePath!), 'playlist-info.md')
    return existsSync(infoFile) ? infoFile : null
  })

  ipcMain.handle(IpcChannels.LIBRARY_READ_PLAYLIST_INFO, async (_event, playlistId: string) => {
    const data = library.load()
    const pl = data.playlists.find((p) => p.id === playlistId)
    if (!pl) return null
    const firstTrack = pl.tracks.find((t) => t.filePath)
    if (!firstTrack) return null
    const infoFile = join(dirname(firstTrack.filePath!), 'playlist-info.md')
    if (!existsSync(infoFile)) return null
    return readFileSync(infoFile, 'utf-8')
  })

  ipcMain.handle(IpcChannels.LIBRARY_OPEN_FILE, async (_event, filePath: string) => {
    if (!existsSync(filePath)) throw new Error('File not found')
    shell.openPath(filePath)
  })

  ipcMain.handle(IpcChannels.LIBRARY_CREATE_DEVICE, async (_event, name: string) => {
    const settings = SettingsService.load()
    if (!settings.musicDir) throw new Error('Set your music folder in Settings first.')
    const slug = sanitizeFilename(name) || 'Device'
    const dir = join(settings.musicDir, 'Devices', slug)
    mkdirSync(dir, { recursive: true })
    return { id: slug, name: name.trim() || 'Device', dir, playlistIds: [] } as Device
  })

  ipcMain.handle(IpcChannels.LIBRARY_DELETE_DEVICE, async (_event, dir: string) => {
    const settings = SettingsService.load()
    if (!settings.musicDir) throw new Error('No music folder configured.')
    // Safety: only ever delete folders that live under <musicDir>/Devices/.
    const base = resolve(join(settings.musicDir, 'Devices'))
    const target = resolve(dir)
    if (target === base || !target.startsWith(base + sep)) {
      throw new Error('Refusing to delete a folder outside TuneVault/Devices.')
    }
    rmSync(target, { recursive: true, force: true })
  })

  ipcMain.handle(
    IpcChannels.LIBRARY_SYNC_DEVICE,
    async (event, device: Device, opts?: { reveal?: boolean }) => {
      if (!device || !device.dir) throw new Error('Invalid device.')
      const reveal = opts?.reveal !== false // default: reveal in Finder (manual Sync)
      const settings = SettingsService.load()
      if (!settings.musicDir) throw new Error('Set your music folder in Settings first.')
      // Safety: a device folder must live under <musicDir>/Devices/.
      const base = resolve(join(settings.musicDir, 'Devices'))
      const root = resolve(device.dir)
      if (root !== base && !root.startsWith(base + sep)) {
        throw new Error('Device folder is outside TuneVault/Devices.')
      }
      mkdirSync(root, { recursive: true })

      const data = library.load()
      const assigned = (device.playlistIds || [])
        .map((id) => data.playlists.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)

      // Tracks already transferred to the iPod live in <root>/.moved/. Treat them
      // as done — don't recopy them into the live folder.
      const movedDir = join(root, '.moved')
      const alreadyMoved = new Set<string>()
      if (existsSync(movedDir)) {
        for (const f of readdirSync(movedDir)) alreadyMoved.add(f.toLowerCase())
      }

      // Flat layout: every assigned track lands directly in the device root so
      // it's a single drag into iTunes. Collect the full ordered set first so we
      // can resolve filename collisions across playlists deterministically.
      const queued: { src: string; fileName: string; track: Track }[] = []
      const used = new Set<string>()
      let skippedMoved = 0
      for (const pl of assigned) {
        const tracks = pl.tracks
          .filter((t) => t.filePath && existsSync(t.filePath))
          .sort((a, b) => a.position - b.position)
        for (const t of tracks) {
          const orig = basename(t.filePath!)
          if (alreadyMoved.has(orig.toLowerCase())) {
            skippedMoved++
            continue
          }
          const ext = extname(orig)
          const stem = orig.slice(0, orig.length - ext.length)
          let fileName = orig
          let n = 2
          while (used.has(fileName.toLowerCase())) fileName = `${stem} (${n++})${ext}`
          used.add(fileName.toLowerCase())
          queued.push({ src: t.filePath!, fileName, track: t })
        }
      }
      const total = queued.length
      const wanted = new Set(queued.map((q) => q.fileName))

      // Mirror: drop any file/folder in root that isn't part of the new flat set
      // (stale tracks, old per-playlist subfolders from a previous version).
      let removed = 0
      for (const entry of readdirSync(root)) {
        if (entry === '.moved') continue // archived ("on iPod") tracks — never prune
        if (entry === `${sanitizeFilename(device.name)}.m3u8`) continue
        if (wanted.has(entry)) continue
        try {
          rmSync(join(root, entry), { recursive: true, force: true })
          removed++
        } catch {
          /* ignore */
        }
      }

      const ffmpeg = new FfmpegService()
      const mb = new MusicBrainzService()
      const metaCache = new Map<string, MbMeta>()
      let copied = 0
      let genreTagged = 0
      let current = 0
      event.sender.send(IpcChannels.LIBRARY_SYNC_DEVICE_PROGRESS, { deviceId: device.id, current, total })

      const m3uEntries: { duration: number; artist: string; title: string; fileName: string }[] = []
      for (const q of queued) {
        current++
        event.sender.send(IpcChannels.LIBRARY_SYNC_DEVICE_PROGRESS, {
          deviceId: device.id,
          current,
          total,
          label: q.track.title
        })
        const destFile = join(root, q.fileName)
        try {
          copyFileSync(q.src, destFile)
          copied++
          m3uEntries.push({
            duration: q.track.duration,
            artist: q.track.artist,
            title: q.track.title,
            fileName: q.fileName
          })
        } catch {
          continue
        }
        const genre = q.track.genre ?? (await lookupMetaCached(mb, metaCache, q.track.artist, q.track.title)).genre
        if (genre) {
          try {
            await ffmpeg.setGenre(destFile, genre)
            genreTagged++
          } catch {
            /* non-fatal */
          }
        }
      }
      writeFileSync(join(root, `${sanitizeFilename(device.name)}.m3u8`), buildM3U(m3uEntries), 'utf-8')

      event.sender.send(IpcChannels.LIBRARY_SYNC_DEVICE_PROGRESS, { deviceId: device.id, current: total, total })
      if (reveal) shell.openPath(root)
      // ponytail: full recopy each sync. Fine for typical libraries; add a
      // size/mtime skip if device folders get large.
      return { playlists: assigned.length, copied, total, genreTagged, removed, skippedMoved }
    }
  )

  // Mark-as-transferred: move everything currently in the live device folder
  // into <root>/.moved/. After you drag the folder into iTunes, this clears it
  // out (recoverably) and future syncs skip those tracks.
  ipcMain.handle(IpcChannels.LIBRARY_DEVICE_ARCHIVE, async (_event, device: Device) => {
    if (!device || !device.dir) throw new Error('Invalid device.')
    const settings = SettingsService.load()
    if (!settings.musicDir) throw new Error('Set your music folder in Settings first.')
    const base = resolve(join(settings.musicDir, 'Devices'))
    const root = resolve(device.dir)
    if (root !== base && !root.startsWith(base + sep)) {
      throw new Error('Device folder is outside TuneVault/Devices.')
    }
    if (!existsSync(root)) return { moved: 0 }
    const movedDir = join(root, '.moved')
    mkdirSync(movedDir, { recursive: true })

    let moved = 0
    for (const entry of readdirSync(root)) {
      if (entry === '.moved') continue
      const full = join(root, entry)
      try {
        if (!statSync(full).isFile()) continue
        if (!AUDIO_EXT.has(extname(entry).toLowerCase())) {
          rmSync(full, { force: true }) // stale .m3u8 etc — drop it
          continue
        }
        const dest = join(movedDir, entry)
        if (existsSync(dest)) rmSync(dest, { force: true }) // rename won't overwrite on Windows
        renameSync(full, dest)
        moved++
      } catch {
        /* ignore */
      }
    }
    return { moved }
  })

  // Delete audio files from a device folder. which='moved' clears the .moved
  // archive, 'live' clears staged files in the root, 'all' does both. These are
  // copies — library originals are untouched.
  ipcMain.handle(
    IpcChannels.LIBRARY_DEVICE_CLEAR,
    async (_event, device: Device, which: 'moved' | 'live' | 'all') => {
      if (!device || !device.dir) throw new Error('Invalid device.')
      const settings = SettingsService.load()
      if (!settings.musicDir) throw new Error('Set your music folder in Settings first.')
      const base = resolve(join(settings.musicDir, 'Devices'))
      const root = resolve(device.dir)
      if (root !== base && !root.startsWith(base + sep)) {
        throw new Error('Device folder is outside TuneVault/Devices.')
      }
      let deleted = 0
      const clearDir = (d: string, audioOnly: boolean): void => {
        if (!existsSync(d)) return
        for (const entry of readdirSync(d)) {
          if (entry === '.moved' && d === root) continue
          const full = join(d, entry)
          try {
            if (audioOnly && !AUDIO_EXT.has(extname(entry).toLowerCase())) continue
            rmSync(full, { recursive: true, force: true })
            deleted++
          } catch {
            /* ignore */
          }
        }
      }
      if (which === 'moved' || which === 'all') clearDir(join(root, '.moved'), false)
      if (which === 'live' || which === 'all') clearDir(root, true)
      return { deleted }
    }
  )

  // How many tracks are sitting in the live folder vs already moved to the iPod.
  ipcMain.handle(IpcChannels.LIBRARY_DEVICE_STATUS, async (_event, dir: string) => {
    try {
      const root = resolve(dir)
      const isAudio = (n: string): boolean => AUDIO_EXT.has(extname(n).toLowerCase())
      const live = existsSync(root) ? readdirSync(root).filter(isAudio).length : 0
      const movedDir = join(root, '.moved')
      const moved = existsSync(movedDir) ? readdirSync(movedDir).filter(isAudio).length : 0
      return { live, moved }
    } catch {
      return { live: 0, moved: 0 }
    }
  })

  ipcMain.handle(
    IpcChannels.LIBRARY_IMPORT,
    async (_event, paths: string[], decision?: 'keep' | 'overwrite' | 'skip') => {
    if (!Array.isArray(paths) || !paths.length) return { imported: 0, playlists: 0 }
    const settings = SettingsService.load()
    if (!settings.musicDir) throw new Error('Set your music folder in Settings first.')
    const ffmpeg = new FfmpegService()

    // Group: each dropped folder -> a playlist named after it; loose files -> "Imported".
    const groups = new Map<string, { title: string; files: string[] }>()
    for (const p of paths) {
      let isDir = false
      try {
        isDir = statSync(p).isDirectory()
      } catch {
        continue
      }
      if (isDir) {
        groups.set(p, { title: basename(p), files: walkAudio(p) })
      } else if (AUDIO_EXT.has(extname(p).toLowerCase())) {
        const g = groups.get('__loose__') ?? { title: 'Imported', files: [] }
        g.files.push(p)
        groups.set('__loose__', g)
      }
    }

    // Dedup by content hash. Existing library tracks carry a fileHash once
    // imported through this path; match against it to spot re-imports.
    const hashes = new Map<string, string>() // src path -> sha1
    const hashOf = (p: string): string => {
      const hit = hashes.get(p)
      if (hit) return hit
      const h = createHash('sha1').update(readFileSync(p)).digest('hex')
      hashes.set(p, h)
      return h
    }
    const existing = new Map<string, string>() // sha1 -> trackId
    for (const pl of library.load().playlists) {
      for (const t of pl.tracks) if (t.fileHash) existing.set(t.fileHash, t.id)
    }
    const allFiles = [...groups.values()].flatMap((g) => g.files)
    const conflicts = allFiles.filter((f) => {
      try {
        return existing.has(hashOf(f))
      } catch {
        return false
      }
    })
    // Dupes found but no decision yet — ask the renderer how to handle them.
    if (conflicts.length && !decision) {
      return { imported: 0, playlists: 0, needsDecision: true, conflicts: conflicts.map((f) => basename(f)) }
    }
    // Overwrite: drop the existing duplicates (files + library rows) up front,
    // then import everything fresh below.
    if (decision === 'overwrite' && conflicts.length) {
      const ids = [...new Set(conflicts.map((f) => existing.get(hashOf(f))!).filter(Boolean))]
      if (ids.length) library.deleteTracks(ids)
    }
    const skipSet = decision === 'skip' ? new Set(conflicts) : new Set<string>()

    let imported = 0
    let playlistCount = 0
    for (const { title, files } of groups.values()) {
      const usableFiles = files.filter((f) => !skipSet.has(f))
      if (!usableFiles.length) continue
      playlistCount++
      const playlistId = `imported:${sanitizeFilename(title)}`
      const playlist = {
        id: playlistId,
        title,
        channelTitle: 'Local Import',
        thumbnailUrl: '',
        tracks: [],
        fetchedAt: new Date().toISOString()
      }
      const destDir = join(settings.musicDir, sanitizeFilename(title))
      mkdirSync(destDir, { recursive: true })

      const tracks: Track[] = []
      let pos = 0
      for (const f of usableFiles) {
        pos++
        const meta = await ffmpeg.probe(f)
        const t = meta.title || basename(f, extname(f))
        const artist = meta.artist || 'Unknown Artist'
        const ext = extname(f).toLowerCase()
        const destName = `${String(pos).padStart(2, '0')} - ${sanitizeFilename(artist)} - ${sanitizeFilename(t)}${ext}`
        const destPath = join(destDir, destName)
        try {
          copyFileSync(f, destPath)
        } catch {
          continue
        }

        // Pull embedded cover art so the track shows a thumbnail in the library.
        let thumbnailUrl = ''
        const coverPath = join(destDir, '.art', `${pos}.jpg`)
        mkdirSync(join(destDir, '.art'), { recursive: true })
        if (await ffmpeg.extractCover(destPath, coverPath)) {
          const clean = process.platform === 'win32' ? coverPath : coverPath.replace(/^\/+/, '')
          thumbnailUrl = `tunevault://audio/${encodeURIComponent(clean)}`
        }

        tracks.push({
          id: `${playlistId}_${pos}`,
          videoId: '',
          title: t,
          artist,
          duration: meta.duration,
          thumbnailUrl,
          playlistId,
          playlistTitle: title,
          position: pos,
          filePath: destPath,
          downloadedAt: new Date().toISOString(),
          bitrate: meta.bitrate,
          genre: meta.genre,
          fileHash: hashes.get(f)
        })
        imported++
      }
      library.addTracks(playlist, tracks)
      // Write the human-readable playlist-info.md alongside the audio (downloads
      // already do this; imports used to skip it).
      try {
        library.writePlaylistInfo(destDir, playlistId)
      } catch {
        /* non-fatal */
      }
    }

    return { imported, playlists: playlistCount }
  })

  ipcMain.handle(IpcChannels.LIBRARY_FETCH_GENRES, async (event, playlistIds: string[]) => {
    const data = library.load()
    const scoped = Array.isArray(playlistIds) && playlistIds.length
    const playlists = data.playlists.filter((p) => !scoped || playlistIds.includes(p.id))

    const mb = new MusicBrainzService()
    const ffmpeg = new FfmpegService()
    const metaCache = new Map<string, MbMeta>()
    const patches: { trackId: string; genre?: string; artist?: string; thumbnailUrl?: string }[] = []
    let genres = 0
    let artwork = 0

    // A track needs a lookup if it's missing a genre OR album art.
    const needs = (t: Track): boolean => !t.genre || !t.thumbnailUrl
    const total = playlists.reduce((n, p) => n + p.tracks.filter(needs).length, 0)
    let current = 0
    event.sender.send(IpcChannels.LIBRARY_FETCH_GENRES_PROGRESS, { current, total })

    for (const pl of playlists) {
      for (const t of pl.tracks) {
        if (!needs(t)) continue
        current++
        event.sender.send(IpcChannels.LIBRARY_FETCH_GENRES_PROGRESS, { current, total, label: t.title })

        const meta = await lookupMetaCached(mb, metaCache, t.artist, t.title)
        const patch: { trackId: string; genre?: string; artist?: string; thumbnailUrl?: string } = {
          trackId: t.id
        }

        if (!t.genre && meta.genre) {
          patch.genre = meta.genre
          genres++
          if (t.filePath && existsSync(t.filePath)) {
            try {
              await ffmpeg.setTags(t.filePath, { genre: meta.genre })
            } catch {
              /* non-fatal */
            }
          }
        }

        // Fill in a real artist only when the file had none (don't overwrite).
        const unknownArtist = !t.artist || t.artist.trim().toLowerCase() === 'unknown artist'
        if (unknownArtist && meta.mbArtist) {
          patch.artist = meta.mbArtist
          if (t.filePath && existsSync(t.filePath)) {
            try {
              await ffmpeg.setTags(t.filePath, { artist: meta.mbArtist })
            } catch {
              /* non-fatal */
            }
          }
        }

        // Album art: download the Cover Art Archive front image, point the
        // library at it, and embed it into the file for iTunes/devices.
        if (!t.thumbnailUrl && meta.coverUrl && t.filePath) {
          const artDir = join(dirname(t.filePath), '.art')
          mkdirSync(artDir, { recursive: true })
          const imgPath = join(artDir, `mb-${t.id.replace(/[^a-z0-9]/gi, '_')}.jpg`)
          if (await ffmpeg.fetchArtwork(meta.coverUrl, imgPath)) {
            const clean = process.platform === 'win32' ? imgPath : imgPath.replace(/^\/+/, '')
            patch.thumbnailUrl = `tunevault://audio/${encodeURIComponent(clean)}`
            artwork++
            try {
              await ffmpeg.embedArtwork(t.filePath, imgPath)
            } catch {
              /* non-fatal: library still shows the saved image */
            }
          }
        }

        if (patch.genre !== undefined || patch.artist !== undefined || patch.thumbnailUrl !== undefined) {
          patches.push(patch)
          // Live update: push the patch to the renderer so the row updates now.
          event.sender.send(IpcChannels.LIBRARY_FETCH_GENRES_PROGRESS, { current, total, label: t.title, patch })
        }
      }
    }

    library.applyTrackPatches(patches)
    return { updated: patches.length, genres, artwork, tracks: total }
  })

  // Re-apply every track's library metadata back onto its file (title/artist/
  // genre) and regenerate each playlist's playlist-info.md. Use this after the
  // app gains new tagging features so older files get brought up to date.
  ipcMain.handle(IpcChannels.LIBRARY_REBUILD_METADATA, async (event, playlistIds: string[]) => {
    const data = library.load()
    const scoped = Array.isArray(playlistIds) && playlistIds.length
    const playlists = data.playlists.filter((p) => !scoped || playlistIds.includes(p.id))
    const ffmpeg = new FfmpegService()

    const total = playlists.reduce(
      (n, p) => n + p.tracks.filter((t) => t.filePath && existsSync(t.filePath)).length,
      0
    )
    let current = 0
    let tagged = 0
    let firstError: string | undefined
    event.sender.send(IpcChannels.LIBRARY_REBUILD_PROGRESS, { current, total })

    for (const pl of playlists) {
      for (const t of pl.tracks) {
        if (!t.filePath || !existsSync(t.filePath)) continue
        current++
        event.sender.send(IpcChannels.LIBRARY_REBUILD_PROGRESS, { current, total, label: t.title })
        try {
          await ffmpeg.setTags(t.filePath, { title: t.title, artist: t.artist, genre: t.genre ?? '' })
          tagged++
        } catch (e) {
          firstError ??= (e as Error).message // surface why instead of a silent 0/N
        }
      }
      // Regenerate the markdown info file in the playlist's own folder.
      const first = pl.tracks.find((t) => t.filePath)
      if (first?.filePath) {
        try {
          library.writePlaylistInfo(dirname(first.filePath), pl.id)
        } catch {
          /* non-fatal */
        }
      }
    }

    return { playlists: playlists.length, tracks: total, tagged, error: firstError }
  })

  ipcMain.handle(IpcChannels.LIBRARY_OPEN_FOLDER, async (_event, filePath: string) => {
    try {
      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        shell.openPath(filePath)
      } else {
        shell.showItemInFolder(filePath)
      }
    } catch {
      // Path doesn't exist, try opening parent directory
      shell.openPath(dirname(filePath))
    }
  })
}
