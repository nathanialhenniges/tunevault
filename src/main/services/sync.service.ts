import { BrowserWindow } from 'electron'
import { YouTubeService } from './youtube.service'
import { LibraryService } from './library.service'
import { SettingsService } from './settings.service'
import { IpcChannels } from '../../shared/ipc-channels'
import type { SyncResult } from '../../shared/models'

export class SyncService {
  private timer: ReturnType<typeof setInterval> | null = null
  private youtube: YouTubeService
  private mainWindow: BrowserWindow | null = null
  private checking = false

  constructor() {
    this.youtube = new YouTubeService()
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  start(intervalHours: number): void {
    this.stop()
    // Guard against corrupt settings (NaN/0/negative) that would make setInterval
    // fire continuously. Default to 6h; floor at 15min to avoid hammering YouTube.
    const hours = Number.isFinite(intervalHours) && intervalHours > 0 ? intervalHours : 6
    const ms = Math.max(15 * 60 * 1000, hours * 60 * 60 * 1000)
    this.timer = setInterval(() => this.checkAll(), ms)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async checkAll(): Promise<void> {
    if (this.checking) return
    this.checking = true

    let totalNewTracks = 0
    let playlistsChecked = 0

    try {
      this.sendStatus(true, 'Checking for new tracks…')

      const settings = SettingsService.load()
      const syncedIds = settings.sync.syncedPlaylistIds
      if (syncedIds.length === 0) {
        this.sendStatus(false, 'No playlists configured for sync')
        return
      }

      const library = new LibraryService().load()
      const libraryPlaylistIds = new Set(library.playlists.map((p) => p.id))

      for (const playlistId of syncedIds) {
        if (!libraryPlaylistIds.has(playlistId)) continue
        const newCount = await this.checkOne(playlistId, library)
        totalNewTracks += newCount
        playlistsChecked++
      }

      SettingsService.save({ sync: { ...settings.sync, lastSyncTime: new Date().toISOString() } })
    } catch (err) {
      console.error('Sync checkAll error:', err)
      this.sendStatus(false, 'Sync failed — check logs')
      return
    } finally {
      this.checking = false
    }

    if (totalNewTracks > 0) {
      this.sendStatus(false, `Found ${totalNewTracks} new track${totalNewTracks !== 1 ? 's' : ''}`)
    } else if (playlistsChecked > 0) {
      this.sendStatus(false, `All ${playlistsChecked} playlist${playlistsChecked !== 1 ? 's' : ''} up to date`)
    } else {
      this.sendStatus(false, 'No synced playlists found in library')
    }
  }

  async checkOne(
    playlistId: string,
    library?: ReturnType<LibraryService['load']>
  ): Promise<number> {
    try {
      const lib = library ?? new LibraryService().load()
      const existingPlaylist = lib.playlists.find((p) => p.id === playlistId)
      if (!existingPlaylist) return 0

      const url = `https://www.youtube.com/playlist?list=${playlistId}`
      const fetched = await this.youtube.fetchPlaylist(url)

      const existingVideoIds = new Set(existingPlaylist.tracks.map((t) => t.videoId))
      const newTracks = fetched.tracks.filter((t) => !existingVideoIds.has(t.videoId))

      if (newTracks.length > 0) {
        const result: SyncResult = {
          playlistId,
          playlistTitle: fetched.title,
          newTracks,
          checkedAt: new Date().toISOString()
        }
        this.mainWindow?.webContents.send(IpcChannels.SYNC_RESULT, result)
      }

      return newTracks.length
    } catch (err) {
      console.error(`Sync error for playlist ${playlistId}:`, err)
      return 0
    }
  }

  private sendStatus(syncing: boolean, message?: string): void {
    this.mainWindow?.webContents.send(IpcChannels.SYNC_STATUS, { syncing, message })
  }
}

export const syncService = new SyncService()
