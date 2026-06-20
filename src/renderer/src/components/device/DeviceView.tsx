import { useEffect, useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { useSettingsStore } from '../../store/settingsStore'
import { toast } from '../../store/toastStore'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import type { Device } from '../../../../shared/models'
import {
  DevicePhoneMobileIcon,
  FolderOpenIcon,
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ArchiveBoxArrowDownIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline'

export function DeviceView(): JSX.Element {
  const library = useLibraryStore((s) => s.library)
  const load = useLibraryStore((s) => s.load)
  const devices = useSettingsStore((s) => s.settings.devices)
  const addDevice = useSettingsStore((s) => s.addDevice)
  const removeDevice = useSettingsStore((s) => s.removeDevice)
  const toggleDevicePlaylist = useSettingsStore((s) => s.toggleDevicePlaylist)

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('My iPod')
  // Per-device sync state so each device's Sync button is independent (no global
  // lock disabling every other device).
  const [syncing, setSyncing] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<Record<string, { current: number; total: number }>>({})
  const [confirmDelete, setConfirmDelete] = useState<Device | null>(null)
  // Per-device folder status: live = files staged in the folder, moved = already
  // transferred to the iPod (sitting in .moved/).
  const [status, setStatus] = useState<Record<string, { live: number; moved: number }>>({})
  const [archiving, setArchiving] = useState<Set<string>>(new Set())
  // Manage panel (delete actions) is hidden behind a per-device toggle.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const isSyncing = (id: string): boolean => syncing.has(id)
  const toggleExpanded = (id: string): void =>
    setExpanded((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  useEffect(() => {
    load()
  }, [load])

  const refreshStatus = async (device: Device): Promise<void> => {
    const s = await window.api.deviceStatus(device.dir)
    setStatus((prev) => ({ ...prev, [device.id]: s }))
  }

  // Pull folder status for every device once they're known.
  useEffect(() => {
    devices.forEach((d) => void refreshStatus(d))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices.length])

  // Live per-device copy progress (mirrors the metadata-fetch pattern).
  useEffect(
    () =>
      window.api.onSyncDeviceProgress((p) => {
        setProgress((prev) => ({ ...prev, [p.deviceId]: { current: p.current, total: p.total } }))
      }),
    []
  )

  // Sync one device. reveal=true (manual button) pops the folder in Finder and
  // toasts a summary; reveal=false (background prune after assign/unassign) is silent.
  const runSync = async (device: Device, reveal: boolean): Promise<void> => {
    if (isSyncing(device.id)) return
    setSyncing((s) => new Set(s).add(device.id))
    try {
      const r = await window.api.syncDevice(device, { reveal })
      if (reveal) {
        toast.success(
          `Synced ${r.copied} track${r.copied === 1 ? '' : 's'}` +
            (r.removed ? `, removed ${r.removed} stale` : '')
        )
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSyncing((s) => {
        const next = new Set(s)
        next.delete(device.id)
        return next
      })
      setProgress((prev) => {
        if (!(device.id in prev)) return prev
        const next = { ...prev }
        delete next[device.id]
        return next
      })
      void refreshStatus(device)
    }
  }

  // Move everything in the live folder into .moved/ (call after dragging into iTunes).
  const archive = async (device: Device): Promise<void> => {
    setArchiving((s) => new Set(s).add(device.id))
    try {
      const r = await window.api.archiveDevice(device)
      toast.success(
        r.moved
          ? `Marked ${r.moved} track${r.moved === 1 ? '' : 's'} as transferred`
          : 'Nothing staged to transfer'
      )
      await refreshStatus(device)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setArchiving((s) => {
        const next = new Set(s)
        next.delete(device.id)
        return next
      })
    }
  }

  const clear = async (device: Device, which: 'moved' | 'live'): Promise<void> => {
    try {
      const r = await window.api.clearDevice(device, which)
      toast.success(`Deleted ${r.deleted} file${r.deleted === 1 ? '' : 's'}`)
      await refreshStatus(device)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Add/remove a playlist, then immediately re-mirror the device folder so the
  // change shows up without waiting for a manual Sync.
  const toggleAndSync = async (device: Device, playlistId: string): Promise<void> => {
    const has = device.playlistIds.includes(playlistId)
    const nextIds = has
      ? device.playlistIds.filter((id) => id !== playlistId)
      : [...device.playlistIds, playlistId]
    await toggleDevicePlaylist(device.id, playlistId)
    await runSync({ ...device, playlistIds: nextIds }, false)
  }

  const create = async (): Promise<void> => {
    try {
      const device = await window.api.createDeviceFolder(newName.trim() || 'Device')
      await addDevice(device)
      setShowNew(false)
      toast.success(`Device "${device.name}" created`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const del = async (device: Device): Promise<void> => {
    try {
      await window.api.deleteDeviceFolder(device.dir)
      await removeDevice(device.id)
      setConfirmDelete(null)
      toast.success(`Device "${device.name}" deleted`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        subtitle="Create a device, assign playlists to it, then Sync to mirror them into its folder. Drag that into iTunes to sync your iPod."
        actions={
          <button
            onClick={() => setShowNew(true)}
            className="btn-accent px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 shrink-0"
          >
            <PlusIcon className="w-4 h-4" /> New Device
          </button>
        }
      />

      {devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-25" style={{ background: 'var(--accent)' }} />
            <DevicePhoneMobileIcon className="relative w-12 h-12 text-accent opacity-80" />
          </div>
          <p className="text-base font-medium text-text-primary">No devices yet</p>
          <p className="text-sm text-text-secondary mt-1 max-w-xs">
            Create one to start assigning playlists and syncing to your iPod.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="btn-accent px-4 py-2 mt-5 rounded-lg text-sm flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4" /> New Device
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => {
            const assigned = library.playlists.filter((p) => device.playlistIds.includes(p.id))
            const available = library.playlists.filter((p) => !device.playlistIds.includes(p.id))
            return (
              <div
                key={device.id}
                className="glass-float glass-border-float rounded-[var(--radius-card)] p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <DevicePhoneMobileIcon className="w-5 h-5 text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{device.name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {status[device.id]
                        ? `${status[device.id].live} staged · ${status[device.id].moved} on iPod`
                        : device.dir}
                    </p>
                  </div>
                  {(status[device.id]?.live ?? 0) > 0 && (
                    <button
                      disabled={archiving.has(device.id)}
                      onClick={() => archive(device)}
                      title="Move staged files into .moved (mark as transferred to the iPod)"
                      className="px-3 py-1.5 text-xs bg-glass-hover hover:bg-glass-active rounded-lg btn-press disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <ArchiveBoxArrowDownIcon className="w-4 h-4" />
                      {archiving.has(device.id) ? 'Moving…' : 'Mark transferred'}
                    </button>
                  )}
                  <button
                    onClick={() => window.api.openFolder(device.dir)}
                    className="px-3 py-1.5 text-xs bg-glass-hover hover:bg-glass-active rounded-lg btn-press flex items-center gap-1.5"
                  >
                    <FolderOpenIcon className="w-4 h-4" /> Open
                  </button>
                  <button
                    disabled={isSyncing(device.id)}
                    onClick={() => runSync(device, true)}
                    className="btn-accent px-3 py-1.5 text-xs rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <ArrowPathIcon
                      className={`w-4 h-4 ${isSyncing(device.id) ? 'animate-spin' : ''}`}
                    />
                    {isSyncing(device.id)
                      ? progress[device.id] && progress[device.id].total > 0
                        ? `Syncing ${progress[device.id].current}/${progress[device.id].total}`
                        : 'Syncing…'
                      : 'Sync'}
                  </button>
                  <button
                    onClick={() => toggleExpanded(device.id)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg btn-press ${
                      expanded.has(device.id)
                        ? 'bg-glass-active text-text-primary'
                        : 'bg-glass-hover hover:bg-glass-active'
                    }`}
                    title="Manage folder"
                  >
                    <EllipsisHorizontalIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(device)}
                    className="px-2.5 py-1.5 text-xs text-red-500 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg btn-press"
                    title="Delete device"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Manage panel — hidden until toggled. Holds the destructive
                    folder actions so they're out of the way. */}
                {expanded.has(device.id) && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-glass-hover px-3 py-2.5">
                    <span className="text-xs text-text-secondary">
                      {(status[device.id]?.live ?? 0)} staged · {(status[device.id]?.moved ?? 0)} on iPod
                    </span>
                    <div className="flex-1" />
                    <button
                      disabled={(status[device.id]?.live ?? 0) === 0}
                      onClick={() => clear(device, 'live')}
                      className="px-2.5 py-1 text-xs text-red-500 dark:text-red-400 border border-red-500/25 rounded-lg hover:bg-red-500/10 disabled:opacity-40 flex items-center gap-1.5"
                      title="Delete files staged in the live folder (originals are kept)"
                    >
                      <TrashIcon className="w-3.5 h-3.5" /> Clear staged
                    </button>
                    <button
                      disabled={(status[device.id]?.moved ?? 0) === 0}
                      onClick={() => clear(device, 'moved')}
                      className="px-2.5 py-1 text-xs text-red-500 dark:text-red-400 border border-red-500/25 rounded-lg hover:bg-red-500/10 disabled:opacity-40 flex items-center gap-1.5"
                      title="Delete the transferred (.moved) copies — they'll re-sync as new"
                    >
                      <TrashIcon className="w-3.5 h-3.5" /> Clear transferred
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {assigned.length === 0 ? (
                    <span className="text-xs text-text-secondary">No playlists assigned yet.</span>
                  ) : (
                    assigned.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 text-xs bg-glass-hover rounded-full pl-3 pr-1.5 py-1"
                      >
                        {p.title}
                        <button
                          onClick={() => toggleAndSync(device, p.id)}
                          className="hover:text-red-500"
                          title="Remove from device"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                  {available.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) toggleAndSync(device, e.target.value)
                      }}
                      className="text-xs bg-glass-input-bg border border-[var(--glass-border-edge)] rounded-lg px-2 py-1.5 text-text-secondary"
                    >
                      <option value="">+ Add playlist…</option>
                      {available.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} className="w-[26rem] p-5">
        <h3 className="text-base font-semibold mb-1">New Device</h3>
        <p className="text-xs text-text-secondary mb-4">
          Creates a folder under <code>TuneVault/Devices/</code>.
        </p>
        <input
          autoFocus
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create()
          }}
          placeholder="Device name (e.g. My iPod)"
          className="w-full bg-glass-input-bg border border-[var(--glass-border-edge)] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent mb-4"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowNew(false)}
            className="px-4 py-2 text-sm bg-glass-hover hover:bg-glass-active rounded-lg btn-press"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!newName.trim()}
            className="btn-accent px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </Modal>

      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} className="w-[26rem] p-5">
        <h3 className="text-base font-semibold mb-1">Delete Device</h3>
        <p className="text-xs text-text-secondary mb-4 break-all">
          Permanently deletes the folder and everything in it:
          <br />
          <code>{confirmDelete?.dir}</code>
          <br />
          Your library originals are not affected.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2 text-sm bg-glass-hover hover:bg-glass-active rounded-lg btn-press"
          >
            Cancel
          </button>
          <button
            onClick={() => confirmDelete && del(confirmDelete)}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg btn-press"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
