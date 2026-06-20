import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import type { AppSettings, Device, DownloadRequest, DownloadProgress, LibraryData, Playlist, SyncConfig, SyncResult, UpdateStatus } from '../shared/models'

const appVersion: string = (() => {
  try {
    return require('../../package.json').version
  } catch {
    return 'unknown'
  }
})()

/** Per-track patch pushed during a metadata fetch so the UI can live-update. */
export interface TrackMetaPatch {
  trackId: string
  genre?: string
  artist?: string
  thumbnailUrl?: string
}
export interface GenreProgress {
  current: number
  total: number
  label?: string
  patch?: TrackMetaPatch
}

const api = {
  getVersion: (): string => appVersion,
  platform: process.platform,

  // Playlist
  fetchPlaylist: (url: string): Promise<Playlist> =>
    ipcRenderer.invoke(IpcChannels.PLAYLIST_FETCH, url),

  // Download
  startDownload: (request: DownloadRequest): Promise<{ started: number }> =>
    ipcRenderer.invoke(IpcChannels.DOWNLOAD_START, request),
  cancelDownload: (trackId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.DOWNLOAD_CANCEL, trackId),
  cancelAllDownloads: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.DOWNLOAD_CANCEL_ALL),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress): void => callback(progress)
    ipcRenderer.on(IpcChannels.DOWNLOAD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.DOWNLOAD_PROGRESS, handler)
  },
  onDownloadComplete: (callback: (data: { trackId: string; filePath: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { trackId: string; filePath: string }): void => callback(data)
    ipcRenderer.on(IpcChannels.DOWNLOAD_COMPLETE, handler)
    return () => ipcRenderer.removeListener(IpcChannels.DOWNLOAD_COMPLETE, handler)
  },
  onDownloadError: (callback: (data: { trackId: string; error: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { trackId: string; error: string }): void => callback(data)
    ipcRenderer.on(IpcChannels.DOWNLOAD_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.DOWNLOAD_ERROR, handler)
  },

  // Library
  getLibrary: (): Promise<LibraryData> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET),
  getTrackPath: (trackId: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET_TRACK_PATH, trackId),
  verifyLibrary: (): Promise<LibraryData> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_VERIFY),
  deleteTracks: (trackIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DELETE_TRACKS, trackIds),
  moveTracks: (trackIds: string[], targetPlaylistId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_MOVE_TRACKS, trackIds, targetPlaylistId),
  renamePlaylist: (playlistId: string, newTitle: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_RENAME_PLAYLIST, playlistId, newTitle),
  setMetadata: (
    trackIds: string[],
    patch: { title?: string; artist?: string; genre?: string }
  ): Promise<{ updated: number; tagged: number }> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_SET_METADATA, trackIds, patch),
  deleteAllLibrary: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DELETE_ALL),
  openFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_OPEN_FOLDER, filePath),
  getPlaylistInfoPath: (playlistId: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_GET_PLAYLIST_INFO_PATH, playlistId),
  readPlaylistInfo: (playlistId: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_READ_PLAYLIST_INFO, playlistId),
  openFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_OPEN_FILE, filePath),
  fetchGenres: (
    playlistIds: string[]
  ): Promise<{ updated: number; genres: number; artwork: number; tracks: number }> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_FETCH_GENRES, playlistIds),
  onFetchGenresProgress: (
    cb: (p: GenreProgress) => void
  ): (() => void) => {
    const handler = (_e: unknown, p: GenreProgress): void => cb(p)
    ipcRenderer.on(IpcChannels.LIBRARY_FETCH_GENRES_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.LIBRARY_FETCH_GENRES_PROGRESS, handler)
  },
  rebuildMetadata: (
    playlistIds: string[]
  ): Promise<{ playlists: number; tracks: number; tagged: number; error?: string }> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_REBUILD_METADATA, playlistIds),
  onRebuildProgress: (
    cb: (p: { current: number; total: number; label?: string }) => void
  ): (() => void) => {
    const handler = (_e: unknown, p: { current: number; total: number; label?: string }): void => cb(p)
    ipcRenderer.on(IpcChannels.LIBRARY_REBUILD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.LIBRARY_REBUILD_PROGRESS, handler)
  },
  // Resolve a dropped File to its absolute path (Electron-only API).
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  importPaths: (
    paths: string[],
    decision?: 'keep' | 'overwrite' | 'skip'
  ): Promise<{ imported: number; playlists: number; needsDecision?: boolean; conflicts?: string[] }> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_IMPORT, paths, decision),
  createDeviceFolder: (name: string): Promise<Device> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_CREATE_DEVICE, name),
  deleteDeviceFolder: (dir: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DELETE_DEVICE, dir),
  syncDevice: (
    device: Device,
    opts?: { reveal?: boolean }
  ): Promise<{
    playlists: number
    copied: number
    total: number
    genreTagged: number
    removed: number
    skippedMoved: number
  }> => ipcRenderer.invoke(IpcChannels.LIBRARY_SYNC_DEVICE, device, opts),
  archiveDevice: (device: Device): Promise<{ moved: number }> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DEVICE_ARCHIVE, device),
  deviceStatus: (dir: string): Promise<{ live: number; moved: number }> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DEVICE_STATUS, dir),
  clearDevice: (device: Device, which: 'moved' | 'live' | 'all'): Promise<{ deleted: number }> =>
    ipcRenderer.invoke(IpcChannels.LIBRARY_DEVICE_CLEAR, device, which),
  onSyncDeviceProgress: (
    cb: (p: { deviceId: string; current: number; total: number; label?: string }) => void
  ): (() => void) => {
    const handler = (
      _e: unknown,
      p: { deviceId: string; current: number; total: number; label?: string }
    ): void => cb(p)
    ipcRenderer.on(IpcChannels.LIBRARY_SYNC_DEVICE_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.LIBRARY_SYNC_DEVICE_PROGRESS, handler)
  },

  // Player
  getFileUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.PLAYER_GET_FILE_URL, filePath),

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, settings),
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SELECT_DIRECTORY),

  // Sync
  syncCheckNow: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SYNC_CHECK_NOW),
  syncTogglePlaylist: (playlistId: string): Promise<SyncConfig> =>
    ipcRenderer.invoke(IpcChannels.SYNC_TOGGLE_PLAYLIST, playlistId),
  syncDismissTracks: (playlistId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SYNC_DISMISS_TRACKS, playlistId),
  onSyncResult: (callback: (result: SyncResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: SyncResult): void => callback(result)
    ipcRenderer.on(IpcChannels.SYNC_RESULT, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SYNC_RESULT, handler)
  },
  onSyncStatus: (callback: (status: { syncing: boolean; message?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: { syncing: boolean; message?: string }): void => callback(status)
    ipcRenderer.on(IpcChannels.SYNC_STATUS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.SYNC_STATUS, handler)
  },

  // Update
  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.UPDATE_CHECK),
  downloadUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.UPDATE_DOWNLOAD),
  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.UPDATE_INSTALL),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void =>
      callback(status)
    ipcRenderer.on(IpcChannels.UPDATE_STATUS, handler)
    return () => ipcRenderer.removeListener(IpcChannels.UPDATE_STATUS, handler)
  },

  // Cache & data
  extractColor: (url: string): Promise<{ r: number; g: number; b: number } | null> =>
    ipcRenderer.invoke(IpcChannels.CACHE_EXTRACT_COLOR, url),
  getCacheStats: (): Promise<{ bytes: number; files: number }> =>
    ipcRenderer.invoke(IpcChannels.CACHE_STATS),
  clearCache: (): Promise<{ bytes: number; files: number }> =>
    ipcRenderer.invoke(IpcChannels.CACHE_CLEAR),
  clearAllData: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.CACHE_CLEAR_ALL_DATA),

  // Tray / media key events
  onTrayTogglePlay: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('tray:toggle-play', handler)
    return () => ipcRenderer.removeListener('tray:toggle-play', handler)
  },
  onTrayNext: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('tray:next', handler)
    return () => ipcRenderer.removeListener('tray:next', handler)
  },
  onTrayPrev: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('tray:prev', handler)
    return () => ipcRenderer.removeListener('tray:prev', handler)
  },
  // App-menu actions (Settings ⌘, / View ▸ Toggle Sidebar ⌘\)
  onMenuNavigate: (callback: (path: string) => void) => {
    const handler = (_e: unknown, path: string): void => callback(path)
    ipcRenderer.on('menu:navigate', handler)
    return () => ipcRenderer.removeListener('menu:navigate', handler)
  },
  onToggleSidebar: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('menu:toggle-sidebar', handler)
    return () => ipcRenderer.removeListener('menu:toggle-sidebar', handler)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
