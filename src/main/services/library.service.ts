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
    if (!updates.length) return
    const data = this.loadRaw()
    const map = new Map(updates.map((u) => [u.trackId, u.genre]))
    for (const pl of data.playlists) {
      for (const t of pl.tracks) {
        const g = map.get(t.id)
        if (g) t.genre = g
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
