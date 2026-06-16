import { Menu, shell } from 'electron'

/**
 * Native role-based application menu. Roles give OS-native, localized items
 * (copy/paste/minimize/zoom/reload/devtools/…). The appMenu role labels its
 * items from app.name ("About TuneVault", "Quit TuneVault"). On macOS the bold
 * first-menu title is still bundle-derived in dev ("Electron"); the packaged
 * app shows TuneVault via productName.
 */
export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? ([{ role: 'appMenu' }] as Electron.MenuItemConstructorOptions[]) : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
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
