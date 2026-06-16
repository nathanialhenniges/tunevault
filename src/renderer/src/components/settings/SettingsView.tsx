import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useWolfModeStore } from '../../hooks/useWolfMode'
import type { AudioFormat, DateFormat, ReleaseDateSource, UpdateStatus } from '../../../../shared/models'
import wolfIcon from '../../assets/wolf-icon.png'

export function SettingsView(): JSX.Element {
  const { settings, update, selectMusicDir } = useSettingsStore()
  const wolfUnlocked = useWolfModeStore((s) => s.unlocked)
  const wolfEnabled = useWolfModeStore((s) => s.enabled)
  const toggleWolf = useWolfModeStore((s) => s.toggle)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    return window.api.onUpdateStatus(setUpdateStatus)
  }, [])

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold font-display">Settings</h2>

      {/* Music Directory */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Music Directory</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={settings.musicDir}
            readOnly
            className="flex-1 bg-glass-hover border border-[var(--glass-border-edge)] rounded-lg px-4 py-2.5 text-sm text-text-secondary"
          />
          <button
            onClick={selectMusicDir}
            className="px-4 py-2.5 bg-glass-hover hover:bg-glass-active border border-[var(--glass-border-edge)] rounded-lg text-sm transition"
          >
            Browse
          </button>
        </div>
      </div>

      {/* Audio Format */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Audio Format</label>
        <div className="flex gap-3 flex-wrap">
          {(['flac', 'opus', 'mp3'] as AudioFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => update({ audioFormat: fmt })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                settings.audioFormat === fmt
                  ? 'bg-accent text-text-inverted'
                  : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Date Format */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Date Format</label>
        <div className="flex gap-3 flex-wrap">
          {(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD Mon YYYY'] as DateFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => update({ dateFormat: fmt })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                settings.dateFormat === fmt
                  ? 'bg-accent text-text-inverted'
                  : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Release Date Source */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Release Date Source</label>
        <div className="flex gap-3 flex-wrap">
          {([
            { value: 'youtube' as ReleaseDateSource, label: 'YouTube' },
            { value: 'musicbrainz' as ReleaseDateSource, label: 'MusicBrainz' }
          ]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update({ releaseDateSource: value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                settings.releaseDateSource === value
                  ? 'bg-accent text-text-inverted'
                  : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Concurrency */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Simultaneous Downloads
        </label>
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4, 6, 8].map((n) => (
            <button
              key={n}
              onClick={() => update({ concurrency: n })}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                settings.concurrency === n
                  ? 'bg-accent text-text-inverted'
                  : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Theme</label>
        <div className="flex gap-3 flex-wrap">
          {(['dark', 'light', 'system'] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => update({ theme })}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                settings.theme === theme
                  ? 'bg-accent text-text-inverted'
                  : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Accent Color</label>
        <div className="flex gap-3 flex-wrap">
          {([
            { value: 'orange' as const, label: 'Orange', swatch: '#f97316' },
            { value: 'blue' as const, label: 'Blue', swatch: '#3b82f6' }
          ]).map(({ value, label, swatch }) => (
            <button
              key={value}
              onClick={() => update({ accent: value })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                settings.accent === value
                  ? 'bg-accent text-text-inverted'
                  : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: swatch }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Sync */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Auto-Sync</label>
        <div className="flex gap-3 flex-wrap">
          {(['On', 'Off'] as const).map((opt) => {
            const isOn = opt === 'On'
            const active = settings.sync.enabled === isOn
            return (
              <button
                key={opt}
                onClick={() => update({ sync: { ...settings.sync, enabled: isOn } })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-accent text-text-inverted'
                    : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
        {settings.sync.enabled && (
          <div className="mt-3 space-y-1">
            <label className="block text-xs text-text-muted">Sync Interval (hours)</label>
            <div className="flex items-center gap-3">
              {([1, 3, 6, 12, 24] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => update({ sync: { ...settings.sync, intervalHours: h } })}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                    settings.sync.intervalHours === h
                      ? 'bg-accent text-text-inverted'
                      : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Updates */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Updates</label>
        <p className="text-xs text-text-muted">Current version: v{window.api.getVersion()}</p>
        <div className="flex items-center gap-3 flex-wrap">
          {(!updateStatus || updateStatus.status === 'not-available' || updateStatus.status === 'error') && (
            <button
              onClick={() => window.api.checkForUpdates()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-glass-hover text-text-secondary hover:bg-glass-active transition"
            >
              Check for Updates
            </button>
          )}
          {updateStatus?.status === 'checking' && (
            <span className="text-sm text-text-muted">Checking for updates...</span>
          )}
          {updateStatus?.status === 'available' && (
            <>
              <span className="text-sm text-text-primary">
                Version {updateStatus.version} available
              </span>
              <button
                onClick={() => window.api.downloadUpdate()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-text-inverted transition"
              >
                Download Update
              </button>
            </>
          )}
          {updateStatus?.status === 'downloading' && (
            <span className="text-sm text-text-muted">
              Downloading... {updateStatus.progress ?? 0}%
            </span>
          )}
          {updateStatus?.status === 'downloaded' && (
            <>
              <span className="text-sm text-text-primary">Update ready to install</span>
              <button
                onClick={() => window.api.installUpdate()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-text-inverted transition"
              >
                Restart Now
              </button>
            </>
          )}
        </div>
        {updateStatus?.status === 'not-available' && (
          <p className="text-xs text-text-muted">You&apos;re up to date.</p>
        )}
        {updateStatus?.status === 'error' && (
          <p className="text-xs text-red-400">{updateStatus.error}</p>
        )}
      </div>

      {/* Wolf Mode — only visible after Konami code unlock */}
      {wolfUnlocked && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Wolf Mode</label>
          <button
            onClick={toggleWolf}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              wolfEnabled
                ? 'bg-accent text-text-inverted'
                : 'bg-glass-hover text-text-secondary hover:bg-glass-active'
            }`}
          >
            <img src={wolfIcon} alt="" className="w-5 h-5" />
            {wolfEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      )}
    </div>
  )
}
