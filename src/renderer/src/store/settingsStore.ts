import { create } from 'zustand'
import type { AppSettings, AccentColor, Device } from '../../../shared/models'
import { DEFAULT_SETTINGS } from '../../../shared/models'
import { toast } from './toastStore'

function applyTheme(theme: 'dark' | 'light' | 'system'): void {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
}

function applyAccent(accent: AccentColor): void {
  document.documentElement.dataset.accent = accent
}

let mqlListener: ((e: MediaQueryListEvent) => void) | null = null
const mql = window.matchMedia('(prefers-color-scheme: dark)')

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (partial: Partial<AppSettings>) => Promise<void>
  selectMusicDir: () => Promise<void>
  addDevice: (device: Device) => Promise<void>
  removeDevice: (id: string) => Promise<void>
  toggleDevicePlaylist: (deviceId: string, playlistId: string) => Promise<void>
}

async function persistDevices(
  devices: Device[],
  set: (partial: Partial<SettingsState>) => void
): Promise<void> {
  const settings = await window.api.setSettings({ devices })
  set({ settings })
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await window.api.getSettings()
    applyTheme(settings.theme)
    applyAccent(settings.accent)
    set({ settings, loaded: true })

    // Remove previous listener before adding new one
    if (mqlListener) {
      mql.removeEventListener('change', mqlListener)
    }
    mqlListener = () => {
      const current = useSettingsStore.getState().settings
      if (current.theme === 'system') {
        applyTheme('system')
      }
    }
    mql.addEventListener('change', mqlListener)
  },

  update: async (partial) => {
    const settings = await window.api.setSettings(partial)
    if (partial.theme) {
      applyTheme(settings.theme)
    }
    if (partial.accent) {
      applyAccent(settings.accent)
    }
    set({ settings })
    toast.success('Settings saved')
  },

  selectMusicDir: async () => {
    const dir = await window.api.selectDirectory()
    if (dir) {
      const settings = await window.api.setSettings({ musicDir: dir })
      set({ settings })
    }
  },

  addDevice: async (device) => {
    const devices = get().settings.devices.filter((d) => d.id !== device.id)
    devices.push(device)
    await persistDevices(devices, set)
  },

  removeDevice: async (id) => {
    await persistDevices(
      get().settings.devices.filter((d) => d.id !== id),
      set
    )
  },

  toggleDevicePlaylist: async (deviceId, playlistId) => {
    const devices = get().settings.devices.map((d) => {
      if (d.id !== deviceId) return d
      const has = d.playlistIds.includes(playlistId)
      return {
        ...d,
        playlistIds: has
          ? d.playlistIds.filter((p) => p !== playlistId)
          : [...d.playlistIds, playlistId]
      }
    })
    await persistDevices(devices, set)
  }
}))
