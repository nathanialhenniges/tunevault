import { useNavigate, useLocation } from 'react-router-dom'
import { useLibraryStore } from '../../store/libraryStore'
import { useDownloadStore } from '../../store/downloadStore'
import {
  QueueListIcon,
  ArrowDownTrayIcon,
  MusicalNoteIcon,
  DevicePhoneMobileIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

const navItems = [
  { path: '/', label: 'Playlists', Icon: QueueListIcon },
  { path: '/downloads', label: 'Downloads', Icon: ArrowDownTrayIcon },
  { path: '/library', label: 'Library', Icon: MusicalNoteIcon },
  { path: '/device', label: 'Device', Icon: DevicePhoneMobileIcon },
  { path: '/settings', label: 'Settings', Icon: Cog6ToothIcon }
]

export function Sidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const library = useLibraryStore((s) => s.library)
  const activeDownloads = useDownloadStore((s) => {
    let count = 0
    s.downloads.forEach((d) => {
      if (d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error') count++
    })
    return count
  })

  const recentPlaylists = library.playlists.slice(0, 5)

  return (
    <aside className="relative w-48 glass-chrome glass-border-sidebar flex flex-col transition-colors duration-200">
      <div className="drag-region h-12 flex items-center pl-[72px] pr-4 border-b border-[var(--glass-border-edge)]">
        <h1 className="text-sm font-bold tracking-wide text-accent no-drag font-display">TuneVault</h1>
      </div>

      <nav className="flex-1 min-h-0 py-2 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors rounded-lg ${
                isActive
                  ? 'bg-accent/12 text-accent ring-1 ring-inset ring-accent/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-glass-hover'
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

      {recentPlaylists.length > 0 && (
        <div className="border-t border-[var(--glass-border-edge)] py-2 px-2 min-h-0 overflow-y-auto">
          <p className="px-3 py-1 text-xs text-text-muted uppercase tracking-wider">
            Downloaded
          </p>
          {recentPlaylists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => navigate('/library', { state: { playlistFilter: pl.id } })}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-glass-hover rounded-[10px] truncate transition-colors"
            >
              {pl.title}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--glass-border-edge)] px-4 py-2">
        <p className="text-xs text-text-muted">v{window.api.getVersion()}</p>
      </div>
    </aside>
  )
}
