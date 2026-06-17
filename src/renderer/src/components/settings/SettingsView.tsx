import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useWolfModeStore } from '../../hooks/useWolfMode'
import type { AudioFormat, DateFormat, ReleaseDateSource, UpdateStatus } from '../../../../shared/models'
import { PageHeader } from '../ui/PageHeader'
import { Segmented } from '../ui/Segmented'
import wolfIcon from '../../assets/wolf-icon.png'

/** A native grouped-list card with a small section heading. */
function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-[var(--radius-card)] border border-[var(--glass-border-edge)] bg-bg-raised divide-y divide-[var(--glass-border-edge)] shadow-[var(--shadow-glass-sm)]">
        {children}
      </div>
    </section>
  )
}

/** A settings row: label (+ optional hint) with its control. `stack` puts the
 *  control on its own line below the label (for wide controls). */
function Field({
  label,
  hint,
  stack,
  children
}: {
  label: string
  hint?: string
  stack?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className={`px-4 py-3 ${stack ? '' : 'flex items-center justify-between gap-4'}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
      <div className={stack ? 'mt-2.5' : 'shrink-0'}>{children}</div>
    </div>
  )
}

export function SettingsView(): JSX.Element {
  const { settings, update, selectMusicDir } = useSettingsStore()
  const wolfUnlocked = useWolfModeStore((s) => s.unlocked)
  const wolfEnabled = useWolfModeStore((s) => s.enabled)
  const toggleWolf = useWolfModeStore((s) => s.toggle)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    const off = window.api.onUpdateStatus(setUpdateStatus)
    return () => { off() }
  }, [])

  return (
    <div className="space-y-7 max-w-2xl">
      <PageHeader title="Settings" />

      <Section title="Library & format">
        <Field label="Music directory" hint="Where downloaded tracks are filed." stack>
          <div className="flex gap-3">
            <input
              type="text"
              value={settings.musicDir}
              readOnly
              className="flex-1 bg-glass-hover border border-[var(--glass-border-edge)] rounded-lg px-3 py-2 text-sm text-text-secondary"
            />
            <button
              onClick={selectMusicDir}
              className="px-4 py-2 bg-glass-hover hover:bg-glass-active border border-[var(--glass-border-edge)] rounded-lg text-sm transition"
            >
              Browse
            </button>
          </div>
        </Field>

        <Field label="Audio format">
          <Segmented
            ariaLabel="Audio format"
            value={settings.audioFormat}
            onChange={(v) => update({ audioFormat: v })}
            options={(['flac', 'opus', 'mp3'] as AudioFormat[]).map((f) => ({ value: f, label: f.toUpperCase() }))}
          />
        </Field>

        <Field label="Date format" stack>
          <Segmented
            ariaLabel="Date format"
            value={settings.dateFormat}
            onChange={(v) => update({ dateFormat: v })}
            options={(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD Mon YYYY'] as DateFormat[]).map((f) => ({ value: f, label: f }))}
          />
        </Field>

        <Field label="Release date source" hint="Where the year/date metadata comes from.">
          <Segmented
            ariaLabel="Release date source"
            value={settings.releaseDateSource}
            onChange={(v) => update({ releaseDateSource: v })}
            options={[
              { value: 'youtube' as ReleaseDateSource, label: 'YouTube' },
              { value: 'musicbrainz' as ReleaseDateSource, label: 'MusicBrainz' }
            ]}
          />
        </Field>

        <Field label="Simultaneous downloads">
          <Segmented
            ariaLabel="Simultaneous downloads"
            size="sm"
            value={settings.concurrency}
            onChange={(v) => update({ concurrency: v })}
            options={[1, 2, 3, 4, 6, 8].map((n) => ({ value: n, label: n }))}
          />
        </Field>
      </Section>

      <Section title="Appearance">
        <Field label="Theme">
          <Segmented
            ariaLabel="Theme"
            value={settings.theme}
            onChange={(v) => update({ theme: v })}
            options={(['dark', 'light', 'system'] as const).map((t) => ({
              value: t,
              label: <span className="capitalize">{t}</span>
            }))}
          />
        </Field>

        <Field label="Accent color">
          <Segmented
            ariaLabel="Accent color"
            value={settings.accent}
            onChange={(v) => update({ accent: v })}
            options={[
              { value: 'orange' as const, swatch: '#f97316', label: 'Orange' },
              { value: 'blue' as const, swatch: '#3b82f6', label: 'Blue' }
            ].map(({ value, swatch, label }) => ({
              value,
              label: (
                <>
                  <span className="w-3 h-3 rounded-full" style={{ background: swatch }} />
                  {label}
                </>
              )
            }))}
          />
        </Field>
      </Section>

      <Section title="Sync">
        <Field label="Auto-sync" hint="Periodically check synced playlists for new tracks.">
          <Segmented
            ariaLabel="Auto-sync"
            value={settings.sync.enabled ? 'on' : 'off'}
            onChange={(v) => update({ sync: { ...settings.sync, enabled: v === 'on' } })}
            options={[
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' }
            ]}
          />
        </Field>
        {settings.sync.enabled && (
          <Field label="Sync interval" hint="Hours between automatic checks.">
            <Segmented
              ariaLabel="Sync interval in hours"
              size="sm"
              value={settings.sync.intervalHours}
              onChange={(v) => update({ sync: { ...settings.sync, intervalHours: v } })}
              options={([1, 3, 6, 12, 24] as const).map((h) => ({ value: h, label: h }))}
            />
          </Field>
        )}
      </Section>

      <Section title="Software update">
        <Field label="Updates" hint={`Current version: v${window.api.getVersion()}`} stack>
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
                <span className="text-sm text-text-primary">Version {updateStatus.version} available</span>
                <button
                  onClick={() => window.api.downloadUpdate()}
                  className="btn-accent px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Download Update
                </button>
              </>
            )}
            {updateStatus?.status === 'downloading' && (
              <span className="text-sm text-text-muted">Downloading... {updateStatus.progress ?? 0}%</span>
            )}
            {updateStatus?.status === 'downloaded' && (
              <>
                <span className="text-sm text-text-primary">Update ready to install</span>
                <button
                  onClick={() => window.api.installUpdate()}
                  className="btn-accent px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Restart Now
                </button>
              </>
            )}
            {updateStatus?.status === 'not-available' && (
              <span className="text-xs text-text-muted">You&apos;re up to date.</span>
            )}
            {updateStatus?.status === 'error' && (
              <span className="text-xs text-red-400">{updateStatus.error}</span>
            )}
          </div>
        </Field>
      </Section>

      {/* Wolf Mode — only visible after Konami code unlock */}
      {wolfUnlocked && (
        <Section title="Secret">
          <Field label="Wolf Mode" hint="You found the easter egg.">
            <Segmented
              ariaLabel="Wolf Mode"
              value={wolfEnabled ? 'on' : 'off'}
              onChange={(v) => {
                if ((v === 'on') !== wolfEnabled) toggleWolf()
              }}
              options={[
                { value: 'on', label: (<><img src={wolfIcon} alt="" className="w-4 h-4" /> On</>) },
                { value: 'off', label: 'Off' }
              ]}
            />
          </Field>
        </Section>
      )}
    </div>
  )
}
