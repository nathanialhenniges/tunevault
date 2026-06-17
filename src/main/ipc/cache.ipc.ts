import { ipcMain, app } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import { CacheService } from '../services/cache.service'

export function registerCacheIpc(): void {
  ipcMain.handle(IpcChannels.CACHE_EXTRACT_COLOR, async (_e, url: string) => {
    return CacheService.extractColor(url)
  })

  ipcMain.handle(IpcChannels.CACHE_STATS, async () => {
    return CacheService.stats()
  })

  ipcMain.handle(IpcChannels.CACHE_CLEAR, async () => {
    CacheService.clearCache()
    return CacheService.stats()
  })

  // Full reset — wipe cache + library + settings, then relaunch so the app comes
  // up clean. The renderer confirms before invoking this.
  ipcMain.handle(IpcChannels.CACHE_CLEAR_ALL_DATA, async () => {
    CacheService.clearAllData()
    app.relaunch()
    app.exit(0)
  })
}
