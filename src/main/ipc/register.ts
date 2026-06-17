import { BrowserWindow } from 'electron'
import { registerPlaylistIpc } from './playlist.ipc'
import { registerDownloadIpc } from './download.ipc'

import { registerLibraryIpc } from './library.ipc'
import { registerPlayerIpc } from './player.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerSyncIpc } from './sync.ipc'
import { registerUpdateIpc } from './update.ipc'
import { registerCacheIpc } from './cache.ipc'

export function registerAllIpc(mainWindow: BrowserWindow): void {
  registerPlaylistIpc()
  registerDownloadIpc(mainWindow)
  registerLibraryIpc()
  registerPlayerIpc()
  registerSettingsIpc()
  registerSyncIpc(mainWindow)
  registerUpdateIpc(mainWindow)
  registerCacheIpc()
}
