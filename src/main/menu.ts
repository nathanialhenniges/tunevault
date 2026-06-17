import { Menu, shell, app, BrowserWindow } from 'electron'

/**
 * Native application menu. Mostly role-based (OS-native, localized items for
 * copy/paste/reload/zoom/…), plus two app-specific items wired to the renderer
 * over IPC: Settings (⌘,) and View ▸ Toggle Sidebar (⌘\). The menu accelerators
 * double as the global keyboard shortcuts.
 */
export function buildAppMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  const send = (channel: string, ...args: unknown[]): void => {
    mainWindow.webContents.send(channel, ...args)
  }

  const settingsItem: Electron.MenuItemConstructorOptions = {
    label: 'Settings…',
    accelerator: 'CmdOrCtrl+,',
    click: () => send('menu:navigate', '/settings')
  }

  const toggleSidebarItem: Electron.MenuItemConstructorOptions = {
    label: 'Toggle Sidebar',
    accelerator: 'CmdOrCtrl+\\',
    click: () => send('menu:toggle-sidebar')
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    ...(isMac
      ? ([{ role: 'fileMenu' }] as Electron.MenuItemConstructorOptions[])
      : ([
          {
            label: 'File',
            submenu: [settingsItem, { type: 'separator' }, { role: 'quit' }]
          }
        ] as Electron.MenuItemConstructorOptions[])),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        toggleSidebarItem,
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'TuneVault on GitHub',
          click: () => shell.openExternal('https://github.com/nathanialhenniges/tunevault')
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
