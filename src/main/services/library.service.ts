import { app } from 'electron'
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readFileSync, renameSync } from 'fs'
import { join } from 'path'
import type { LibraryData, Playlist, Track } from '../../shared/models'

const LIBRARY_VERSION = 1

export class LibraryService {
  private filePath: string
  private static cache: LibraryData | null = null
  private static writeQueue: Promise<void> = Promise.resolve()

  constructor() {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    this.filePath = join(userDataPath, 'library.json')
  }

  private loadFromDisk(): LibraryData {
    // Try main file first
    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, 'utf-8')
        return JSON.parse(raw) as LibraryData
      } catch {
        // Main file corrupted, try tmp fallback
      }
    }

    // Fallback to .tmp file (may exist from interrupted atomic write)
    const tmpPath = this.filePath + '.tmp'
    if (existsSync(tmpPath)) {
      try {
        const raw = readFileSync(tmpPath, 'utf-8')
        const data = JSON.parse(raw) as LibraryData
        // Recover: promote tmp to main
        try { renameSync(tmpPath, this.filePath) } catch { /* best effort */ }
        return data
      } catch {
        // tmp also corrupted
      }
    }

    return { playlists: [], version: LIBRARY_VERSION }
  }

  private loadRaw(): LibraryData {
    if (LibraryService.cache) return LibraryService.cache
    const data = this.loadFromDisk()
    LibraryService.cache = data
    return data
  }

  load(): LibraryData {
    const data = this.loadRaw()
    // Return a deep-ish copy with sorted tracks
    const result: LibraryData = {
      ...data,
      playlists: data.playlists.map((p) => ({
        ...p,
        tracks: [...p.tracks].sort((a, b) => a.position - b.position)
      }))
    }
    return result
  }

  /** Atomic write: write to .tmp then rename over the target */
  private writeToDisk(data: LibraryData): void {
    const tmpPath = this.filePath + '.tmp'
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tmpPath, this.filePath)
  }

  save(data: LibraryData): void {
    LibraryService.cache = data
    this.writeToDisk(data)
  }

  /** Enqueue a mutation to run serially, preventing concurrent read-modify-write races */
  private enqueueWrite(mutate: (data: LibraryData) => void): void {
    LibraryService.writeQueue = LibraryService.writeQueue.then(() => {
      const data = this.loadRaw()
      mutate(data)
      LibraryService.cache = data
      this.writeToDisk(data)
    }).catch(() => {
      // Ensure queue doesn't get stuck on error
    })
  }

  upsertTrack(playlist: Playlist, track: Track): void {
    this.enqueueWrite((data) => {
      let existingPlaylist = data.playlists.find((p) => p.id === playlist.id)

      if (!existingPlaylist) {
        existingPlaylist = { ...playlist, tracks: [] }
        data.playlists.push(existingPlaylist)
      }

      const trackIdx = existingPlaylist.tracks.findIndex((t) => t.id === track.id)
      if (trackIdx >= 0) {
        existingPlaylist.tracks[trackIdx] = track
      } else {
        existingPlaylist.tracks.push(track)
      }
    })
  }

  /** Persist looked-up genres onto matching tracks (atomic single write). */
  setTrackGenres(updates: { trackId: string; genre: string }[]): void {
    this.applyTrackPatches(updates.map((u) => ({ trackId: u.trackId, genre: u.genre })))
  }

  /** Apply a batch of field patches (genre/artist/thumbnailUrl) in one atomic write. */
  applyTrackPatches(
    patches: { trackId: string; genre?: string; artist?: string; thumbnailUrl?: string }[]
  ): void {
    if (!patches.length) return
    const map = new Map(patches.map((p) => [p.trackId, p]))
    const data = this.loadRaw()
    for (const pl of data.playlists) {
      for (const t of pl.tracks) {
        const p = map.get(t.id)
        if (!p) continue
        if (p.genre !== undefined) t.genre = p.genre
        if (p.artist !== undefined) t.artist = p.artist
        if (p.thumbnailUrl !== undefined) t.thumbnailUrl = p.thumbnailUrl
      }
    }
    this.save(data)
  }

  /** Add/merge a batch of tracks into a playlist (atomic single write). */
  addTracks(playlist: Playlist, tracks: Track[]): void {
    const data = this.loadRaw()
    let pl = data.playlists.find((p) => p.id === playlist.id)
    if (!pl) {
      pl = { ...playlist, tracks: [] }
      data.playlists.push(pl)
    }
    for (const t of tracks) {
      const idx = pl.tracks.findIndex((x) => x.id === t.id)
      if (idx >= 0) pl.tracks[idx] = t
      else pl.tracks.push(t)
    }
    this.save(data)
  }

  /**
   * Apply a metadata patch (title/artist/genre) to a set of tracks. Only the
   * provided keys are changed. Returns the updated tracks (so the caller can
   * re-tag their files on disk).
   */
  setTrackMetadata(
    trackIds: string[],
    patch: { title?: string; artist?: string; genre?: string }
  ): Track[] {
    const ids = new Set(trackIds)
    const data = this.loadRaw()
    const updated: Track[] = []
    for (const pl of data.playlists) {
      for (const t of pl.tracks) {
        if (!ids.has(t.id)) continue
        if (patch.title !== undefined) t.title = patch.title
        if (patch.artist !== undefined) t.artist = patch.artist
        if (patch.genre !== undefined) t.genre = patch.genre
        updated.push(t)
      }
    }
    if (updated.length) this.save(data)
    return updated
  }

  /** Rename a playlist (metadata only — files stay on disk). */
  renamePlaylist(playlistId: string, newTitle: string): void {
    const title = newTitle.trim()
    if (!title) throw new Error('Playlist name cannot be empty.')
    const data = this.loadRaw()
    const pl = data.playlists.find((p) => p.id === playlistId)
    if (!pl) throw new Error('Playlist not found.')
    pl.title = title
    for (const t of pl.tracks) t.playlistTitle = title
    this.save(data)
  }

  /** Move tracks out of their current playlists into the target playlist. */
  moveTracks(trackIds: string[], targetPlaylistId: string): void {
    const ids = new Set(trackIds)
    const data = this.loadRaw()
    const target = data.playlists.find((p) => p.id === targetPlaylistId)
    if (!target) throw new Error('Target playlist not found.')

    let pos = target.tracks.reduce((m, t) => Math.max(m, t.position), 0)
    const moving: Track[] = []
    for (const pl of data.playlists) {
      if (pl.id === targetPlaylistId) continue
      const stay: Track[] = []
      for (const t of pl.tracks) {
        if (ids.has(t.id)) moving.push(t)
        else stay.push(t)
      }
      pl.tracks = stay
    }
    for (const t of moving) {
      // Skip a track already in the target (id stays unique across the library).
      if (target.tracks.some((x) => x.id === t.id)) continue
      t.playlistId = target.id
      t.playlistTitle = target.title
      t.position = ++pos
      target.tracks.push(t)
    }

    data.playlists = data.playlists.filter((p) => p.tracks.length > 0)
    this.save(data)
  }

  deleteTracks(trackIds: string[]): void {
    const data = this.loadRaw()
    const idsSet = new Set(trackIds)

    for (const playlist of data.playlists) {
      // Find tracks to delete and remove their files
      for (const track of playlist.tracks) {
        if (idsSet.has(track.id) && track.filePath) {
          try {
            if (existsSync(track.filePath)) {
              unlinkSync(track.filePath)
            }
          } catch {
            // File may already be deleted
          }
        }
      }

      // Remove tracks from playlist
      playlist.tracks = playlist.tracks.filter((t) => !idsSet.has(t.id))
    }

    // Remove empty playlists
    data.playlists = data.playlists.filter((p) => p.tracks.length > 0)

    this.save(data)
  }

  /**
   * Verify all tracks still exist on disk. Remove any whose files are missing.
   * Returns the cleaned library data.
   */
  verify(): LibraryData {
    const data = this.loadRaw()
    let changed = false

    for (const playlist of data.playlists) {
      const before = playlist.tracks.length
      playlist.tracks = playlist.tracks.filter((t) => {
        if (!t.filePath) return false
        return existsSync(t.filePath)
      })
      if (playlist.tracks.length !== before) changed = true
    }

    // Remove empty playlists
    const beforePlaylists = data.playlists.length
    data.playlists = data.playlists.filter((p) => p.tracks.length > 0)
    if (data.playlists.length !== beforePlaylists) changed = true

    if (changed) this.save(data)
    for (const playlist of data.playlists) {
      playlist.tracks.sort((a, b) => a.position - b.position)
    }
    return data
  }

  writePlaylistInfo(playlistDir: string, playlistId: string): void {
    const data = this.loadRaw()
    const pl = data.playlists.find((p) => p.id === playlistId)
    if (!pl) return
    const downloaded = pl.tracks
      .filter((t) => t.filePath)
      .sort((a, b) => a.position - b.position)

    const lines: string[] = []
    lines.push(`# ${pl.title}`)
    lines.push('')
    lines.push(`**Channel:** ${pl.channelTitle}`)
    lines.push(`**Tracks:** ${downloaded.length}`)
    lines.push(`**Downloaded:** ${new Date().toLocaleDateString()}`)
    lines.push('')
    lines.push('---')
    lines.push('')

    // Summary table
    lines.push('| # | Artist | Title | Duration | Date | Bitrate |')
    lines.push('|---|--------|-------|----------|------|---------|')
    for (const t of downloaded) {
      const m = Math.floor(t.duration / 60)
      const s = t.duration % 60
      const dur = `${m}:${String(s).padStart(2, '0')}`
      lines.push(`| ${t.position} | ${t.artist} | ${t.title} | ${dur} | ${t.releaseDate || '-'} | ${t.bitrate ? `${t.bitrate}kbps` : '-'} |`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')

    // Individual track sections with descriptions
    for (const t of downloaded) {
      lines.push(`## ${t.position}. ${t.artist} - ${t.title}`)
      lines.push('')
      if (t.releaseDate) lines.push(`- **Date:** ${t.releaseDate}`)
      if (t.bitrate) lines.push(`- **Bitrate:** ${t.bitrate}kbps`)
      if (t.url) lines.push(`- **URL:** ${t.url}`)
      lines.push('')
      if (t.description) {
        lines.push('**Description:**')
        lines.push('')
        lines.push(t.description)
        lines.push('')
      }
      lines.push('---')
      lines.push('')
    }

    writeFileSync(join(playlistDir, 'playlist-info.md'), lines.join('\n'), 'utf-8')
  }

  deleteAll(): void {
    const data = this.loadRaw()

    // Delete all audio files
    for (const playlist of data.playlists) {
      for (const track of playlist.tracks) {
        if (track.filePath) {
          try {
            if (existsSync(track.filePath)) {
              unlinkSync(track.filePath)
            }
          } catch {
            // File may already be deleted
          }
        }
      }
    }

    // Clear library
    this.save({ playlists: [], version: LIBRARY_VERSION })
  }
}
