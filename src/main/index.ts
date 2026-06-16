import { app, shell, BrowserWindow, globalShortcut, nativeImage, protocol, net } from 'electron'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpc } from './ipc/register'
import { buildAppMenu } from './menu'
import { createTray } from './tray'
import { abortAllDownloads, hasActiveDownloads } from './ipc/download.ipc'
import { SettingsService } from './services/settings.service'

function getIconPath(): string {
  return is.dev
    ? join(app.getAppPath(), 'build', 'icon.png')
    : join(process.resourcesPath, 'icon.png')
}

// Catch uncaught exceptions and unhandled rejections so the app doesn't crash silently
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

// Set the app name BEFORE `ready` (and before anything resolves getPath('userData')).
// macOS reads the menu/app name and the userData dir at launch — setting this inside
// whenReady() is too late, leaving menus as "Electron" and scattering saved data.
app.setName('TuneVault')

// 1.4 — Single instance lock: prevent multiple app instances writing to same data files
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {

// Register custom protocol for serving local audio files
// This avoids CSP and cross-origin issues with file:// URLs
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tunevault',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'

  const opts: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'TuneVault',
    icon: getIconPath(),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    // macOS: native window vibrancy (frosted translucency). Others: solid bg.
    backgroundColor: isMac ? '#00000000' : '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  }
  if (isMac) {
    opts.trafficLightPosition = { x: 16, y: 16 }
    opts.vibrancy = 'under-window'
    opts.visualEffectState = 'active'
  }
  if (isWin) {
    // Native window controls (min/max/close) drawn by the OS into our chrome.
    opts.titleBarOverlay = { color: '#0f0f12', symbolColor: '#fafafa', height: 48 }
  }

  const mainWindow = new BrowserWindow(opts)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Hide instead of close when downloads are active so they continue in the background
  mainWindow.on('close', (e) => {
    const quitting = (app as unknown as Record<string, boolean>).isQuitting
    if (hasActiveDownloads() && !quitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  // 1.6 — Only allow https/http URLs to be opened externally
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Invalid URL — do not open
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nathanialhenniges.tunevault')
  buildAppMenu()

  // Set About panel for macOS to show TuneVault instead of Electron
  if (process.platform === 'darwin') {
    const iconPath = is.dev
      ? join(app.getAppPath(), 'build', 'icon.png')
      : join(process.resourcesPath, 'icon.png')
    app.setAboutPanelOptions({
      applicationName: 'TuneVault',
      applicationVersion: app.getVersion(),
      copyright: '© 2025 Nathanial Henniges',
      iconPath
    })
  }

  // 1.5 — Protocol handler with path traversal protection
  protocol.handle('tunevault', (request) => {
    // URL format: tunevault://audio/<encoded-file-path>
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    // On Windows paths don't start with /, on macOS/Linux they do
    const resolvedPath = resolve(process.platform === 'win32' ? filePath : '/' + filePath)

    // Validate the resolved path is under the configured music directory
    const settings = SettingsService.load()
    const musicDir = resolve(settings.musicDir)
    if (!resolvedPath.startsWith(musicDir + '/') && !resolvedPath.startsWith(musicDir + '\\') && resolvedPath !== musicDir) {
      return new Response('Forbidden', { status: 403 })
    }

    const fileUrl = pathToFileURL(resolvedPath).href

    // Forward Range headers so HTML5 <audio> seeking works
    return net.fetch(fileUrl, {
      headers: request.headers
    })
  })

  // Set dock icon in dev mode (production uses electron-builder config)
  if (process.platform === 'darwin') {
    const iconPath = is.dev
      ? join(app.getAppPath(), 'build', 'icon.png')
      : join(process.resourcesPath, 'icon.png')
    try {
      const icon = nativeImage.createFromPath(iconPath)
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon)
      }
    } catch {
      // Icon may not exist yet
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  // 1.3 — Register IPC handlers once, not on every window creation
  registerAllIpc(mainWindow)
  createTray(mainWindow)

  // Media key support
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('tray:toggle-play')
  })
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('tray:next')
  })
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('tray:prev')
  })

  // 1.3 — On activate, only recreate window (IPC already registered above)
  app.on('activate', () => {
    const existing = BrowserWindow.getAllWindows()
    if (existing.length === 0) {
      createWindow()
    } else {
      existing[0].show()
    }
  })

  // 1.4 — Focus existing window when second instance is launched
  app.on('second-instance', () => {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
})

// Track when the app is truly quitting vs just closing a window
app.on('before-quit', () => {
  ;(app as unknown as Record<string, boolean>).isQuitting = true
  // 2.4 — Abort all active downloads on quit so child processes aren't orphaned
  abortAllDownloads()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !hasActiveDownloads()) {
    app.quit()
  }
})

} // end of single-instance lock block
