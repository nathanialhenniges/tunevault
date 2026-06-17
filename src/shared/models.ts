export interface Track {
  id: string
  videoId: string
  title: string
  artist: string
  duration: number // seconds
  thumbnailUrl: string
  playlistId: string
  playlistTitle: string
  position: number
  filePath?: string
  format?: AudioFormat
  downloadedAt?: string
  releaseDate?: string
  bitrate?: number
  url?: string
  description?: string
  /** Full source URL to download from (YouTube or SoundCloud). Falls back to a YouTube watch URL built from videoId. */
  sourceUrl?: string
  source?: 'youtube' | 'soundcloud'
  /** Looked-up music genre (e.g. from MusicBrainz). Shown in the library + tagged on export. */
  genre?: string
}

export interface Playlist {
  id: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  tracks: Track[]
  fetchedAt: string
}

export type AudioFormat = 'flac' | 'opus' | 'mp3'
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD Mon YYYY'
export type ReleaseDateSource = 'youtube' | 'musicbrainz'
export type AccentColor = 'orange' | 'blue'

export interface DownloadRequest {
  playlist: Playlist
  format: AudioFormat
  outputDir: string
  concurrency: number
  forceRedownload?: boolean
  dateFormat?: DateFormat
  releaseDateSource?: ReleaseDateSource
}

export interface DownloadProgress {
  trackId: string
  videoId: string
  percent: number
  speed: string
  eta: string
  status: 'queued' | 'downloading' | 'converting' | 'tagging' | 'done' | 'skipped' | 'error' | 'rate-limited'
  error?: string
}

export interface LibraryData {
  playlists: Playlist[]
  version: number
}

export interface SyncConfig {
  enabled: boolean
  intervalHours: 1 | 3 | 6 | 12 | 24
  syncedPlaylistIds: string[]
  lastSyncTime: string | null
}

export interface SyncResult {
  playlistId: string
  playlistTitle: string
  newTracks: Track[]
  checkedAt: string
}

/** A managed media device (e.g. an iPod). Its folder lives under TuneVault/Devices/. */
export interface Device {
  id: string
  name: string
  dir: string
  /** Playlists assigned to this device — synced into its folder. */
  playlistIds: string[]
}

/** Row spacing for the track lists. */
export type TrackDensity = 'comfortable' | 'compact'

export interface AppSettings {
  musicDir: string
  /** Managed media devices. Each syncs its assigned playlists into its folder. */
  devices: Device[]
  audioFormat: AudioFormat
  concurrency: number
  theme: 'dark' | 'light' | 'system'
  accent: AccentColor
  trackDensity: TrackDensity
  dateFormat: DateFormat
  releaseDateSource: ReleaseDateSource
  sync: SyncConfig
}

export const DEFAULT_SETTINGS: AppSettings = {
  musicDir: '',
  devices: [],
  audioFormat: 'mp3',
  concurrency: 2,
  theme: 'dark',
  accent: 'orange',
  trackDensity: 'comfortable',
  dateFormat: 'MM/DD/YYYY',
  releaseDateSource: 'youtube',
  sync: { enabled: false, intervalHours: 6, syncedPlaylistIds: [], lastSyncTime: null }
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  error?: string
  progress?: number
}
