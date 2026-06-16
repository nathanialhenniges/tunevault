import { ipcMain, shell } from 'electron'
import { basename, dirname, extname, join, resolve, sep } from 'path'
import {
  statSync,
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
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

// Shared genre resolution: cache hit returns immediately; cache miss looks it up via
// MusicBrainz, caches it (incl. null = "no genre"), and rate-limits to ~1 req/sec.
async function lookupGenreCached(
  mb: MusicBrainzService,
  cache: Map<string, string | null>,
  artist: string,
  title: string
): Promise<string | null> {
  const key = `${artist} ${title}`
  if (cache.has(key)) return cache.get(key) ?? null
  const genre = await mb.lookupGenre(artist, title)
  cache.set(key, genre)
  await delay(1100)
  return genre
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

  ipcMain.handle(IpcChannels.LIBRARY_SYNC_DEVICE, async (_event, device: Device) => {
    if (!device || !device.dir) throw new Error('Invalid device.')
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
    const assignedFolders = new Set(assigned.map((p) => sanitizeFilename(p.title)))

    // Mirror: drop folders for playlists no longer assigned to this device.
    let removed = 0
    for (const entry of readdirSync(root)) {
      const full = join(root, entry)
      try {
        if (statSync(full).isDirectory() && !assignedFolders.has(entry)) {
          rmSync(full, { recursive: true, force: true })
          removed++
        }
      } catch {
        /* ignore */
      }
    }

    const ffmpeg = new FfmpegService()
    const mb = new MusicBrainzService()
    const genreCache = new Map<string, string | null>()
    let copied = 0
    let total = 0
    let genreTagged = 0

    for (const pl of assigned) {
      const tracks = pl.tracks
        .filter((t) => t.filePath && existsSync(t.filePath))
        .sort((a, b) => a.position - b.position)
      total += tracks.length
      // Wipe + rebuild the playlist folder so removed tracks disappear (true mirror).
      const destDir = join(root, sanitizeFilename(pl.title))
      rmSync(destDir, { recursive: true, force: true })
      mkdirSync(destDir, { recursive: true })
      const m3uEntries: { duration: number; artist: string; title: string; fileName: string }[] = []
      for (const t of tracks) {
        const fileName = basename(t.filePath!)
        const destFile = join(destDir, fileName)
        try {
          copyFileSync(t.filePath!, destFile)
          copied++
          m3uEntries.push({ duration: t.duration, artist: t.artist, title: t.title, fileName })
        } catch {
          continue
        }
        const genre = t.genre ?? (await lookupGenreCached(mb, genreCache, t.artist, t.title))
        if (genre) {
          try {
            await ffmpeg.setGenre(destFile, genre)
            genreTagged++
          } catch {
            /* non-fatal */
          }
        }
      }
      writeFileSync(join(destDir, `${sanitizeFilename(pl.title)}.m3u8`), buildM3U(m3uEntries), 'utf-8')
    }

    shell.openPath(root)
    return { playlists: assigned.length, copied, total, genreTagged, removed }
  })

  ipcMain.handle(IpcChannels.LIBRARY_IMPORT, async (_event, paths: string[]) => {
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

    let imported = 0
    let playlistCount = 0
    for (const { title, files } of groups.values()) {
      if (!files.length) continue
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
      for (const f of files) {
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
          genre: meta.genre
        })
        imported++
      }
      library.addTracks(playlist, tracks)
    }

    return { imported, playlists: playlistCount }
  })

  ipcMain.handle(IpcChannels.LIBRARY_FETCH_GENRES, async (_event, playlistIds: string[]) => {
    const data = library.load()
    const scoped = Array.isArray(playlistIds) && playlistIds.length
    const playlists = data.playlists.filter((p) => !scoped || playlistIds.includes(p.id))

    const mb = new MusicBrainzService()
    const ffmpeg = new FfmpegService()
    const genreCache = new Map<string, string | null>()
    const updates: { trackId: string; genre: string }[] = []
    let tagged = 0

    for (const pl of playlists) {
      for (const t of pl.tracks) {
        if (t.genre) continue // already known
        const genre = await lookupGenreCached(mb, genreCache, t.artist, t.title)
        if (genre) {
          updates.push({ trackId: t.id, genre })
          if (t.filePath && existsSync(t.filePath)) {
            try {
              await ffmpeg.setGenre(t.filePath, genre)
              tagged++
            } catch {
              /* non-fatal: genre still stored in the library */
            }
          }
        }
      }
    }

    library.setTrackGenres(updates)
    return { updated: updates.length, tagged }
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
