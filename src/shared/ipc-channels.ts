export const IpcChannels = {
  // Playlist
  PLAYLIST_FETCH: 'playlist:fetch',

  // Download
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_CANCEL_ALL: 'download:cancel-all',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_ERROR: 'download:error',

  // Library
  LIBRARY_GET: 'library:get',
  LIBRARY_GET_TRACK_PATH: 'library:get-track-path',
  LIBRARY_DELETE_TRACKS: 'library:delete-tracks',
  LIBRARY_MOVE_TRACKS: 'library:move-tracks',
  LIBRARY_RENAME_PLAYLIST: 'library:rename-playlist',
  LIBRARY_SET_METADATA: 'library:set-metadata',
  LIBRARY_DELETE_ALL: 'library:delete-all',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',
  LIBRARY_GET_PLAYLIST_INFO_PATH: 'library:get-playlist-info-path',
  LIBRARY_READ_PLAYLIST_INFO: 'library:read-playlist-info',
  LIBRARY_VERIFY: 'library:verify',
  LIBRARY_OPEN_FILE: 'library:open-file',
  LIBRARY_FETCH_GENRES: 'library:fetch-genres',
  LIBRARY_FETCH_GENRES_PROGRESS: 'library:fetch-genres-progress',
  LIBRARY_REBUILD_METADATA: 'library:rebuild-metadata',
  LIBRARY_REBUILD_PROGRESS: 'library:rebuild-progress',
  LIBRARY_IMPORT: 'library:import',
  LIBRARY_CREATE_DEVICE: 'library:create-device',
  LIBRARY_DELETE_DEVICE: 'library:delete-device',
  LIBRARY_SYNC_DEVICE: 'library:sync-device',
  LIBRARY_SYNC_DEVICE_PROGRESS: 'library:sync-device-progress',
  LIBRARY_DEVICE_ARCHIVE: 'library:device-archive',
  LIBRARY_DEVICE_STATUS: 'library:device-status',
  LIBRARY_DEVICE_CLEAR: 'library:device-clear',

  // Player
  PLAYER_GET_FILE_URL: 'player:get-file-url',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SELECT_DIRECTORY: 'settings:select-directory',

  // Sync
  SYNC_CHECK_NOW: 'sync:check-now',
  SYNC_RESULT: 'sync:result',
  SYNC_STATUS: 'sync:status',
  SYNC_TOGGLE_PLAYLIST: 'sync:toggle-playlist',
  SYNC_DISMISS_TRACKS: 'sync:dismiss-tracks',

  // Update
  UPDATE_CHECK: 'update:check',
  UPDATE_STATUS: 'update:status',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',

  // Cache & data
  CACHE_EXTRACT_COLOR: 'cache:extract-color',
  CACHE_STATS: 'cache:stats',
  CACHE_CLEAR: 'cache:clear',
  CACHE_CLEAR_ALL_DATA: 'cache:clear-all-data'
} as const
