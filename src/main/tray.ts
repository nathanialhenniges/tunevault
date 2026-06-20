import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  // Use a simple 16x16 tray icon
  const iconPath = is.dev
    ? join(app.getAppPath(), 'build', 'icon.png')
    : join(process.resourcesPath, 'icon.png')

  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } catch {
    // Fallback to empty icon if build icon not available
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('TuneVault')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show TuneVault',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Play/Pause',
      click: () => {
        mainWindow.webContents.send('tray:toggle-play')
      }
    },
    {
      label: 'Next Track',
      click: () => {
        mainWindow.webContents.send('tray:next')
      }
    },
    {
      label: 'Previous Track',
      click: () => {
        mainWindow.webContents.send('tray:prev')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  // Release the tray icon explicitly on quit instead of leaving it to GC.
  app.once('before-quit', () => {
    tray?.destroy()
    tray = null
  })
}
