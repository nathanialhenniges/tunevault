import { useNavigate, useLocation } from 'react-router-dom'
import { useDownloadStore } from '../../store/downloadStore'
import {
  HomeIcon,
  QueueListIcon,
  ArrowDownTrayIcon,
  MusicalNoteIcon,
  DevicePhoneMobileIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

const navItems = [
  { path: '/', label: 'Home', Icon: HomeIcon },
  { path: '/playlists', label: 'Playlists', Icon: QueueListIcon },
  { path: '/downloads', label: 'Downloads', Icon: ArrowDownTrayIcon },
  { path: '/library', label: 'Library', Icon: MusicalNoteIcon },
  { path: '/device', label: 'Device', Icon: DevicePhoneMobileIcon },
  { path: '/settings', label: 'Settings', Icon: Cog6ToothIcon }
]

export function Sidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const activeDownloads = useDownloadStore((s) => {
    let count = 0
    s.downloads.forEach((d) => {
      if (d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error') count++
    })
    return count
  })

  return (
    <aside className="relative w-48 glass-chrome glass-border-sidebar flex flex-col transition-colors duration-200">
      <div className="drag-region h-12 flex items-center pl-[72px] pr-4 border-b border-[var(--glass-border-edge)]">
        {/* Wordmark, not a document heading — the per-view PageHeader owns the h1. */}
        <div className="text-[15px] font-semibold tracking-tight text-text-primary no-drag font-display">TuneVault</div>
      </div>

      <nav className="flex-1 min-h-0 py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-[7px] text-[13px] transition-colors rounded-[var(--radius-item)] ${
                isActive
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'text-text-secondary font-medium hover:text-text-primary hover:bg-glass-hover'
              }`}
            >
              <item.Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.path === '/downloads' && activeDownloads > 0 && (
                <span className="ml-auto text-xs bg-accent-glow text-accent px-1.5 py-0.5 rounded-full">
                  {activeDownloads}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--glass-border-edge)] px-4 py-2">
        <p className="text-xs text-text-muted">v{window.api.getVersion()}</p>
      </div>
    </aside>
  )
}
