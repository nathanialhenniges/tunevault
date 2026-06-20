import { useRef, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

interface MainLayoutProps {
  children: React.ReactNode
}

// Same order as the sidebar nav — Cmd/Ctrl+1..6 jumps between views (native tab feel).
const VIEW_PATHS = ['/', '/playlists', '/downloads', '/library', '/device', '/settings']

export function MainLayout({ children }: MainLayoutProps): JSX.Element {
  const mainRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarHidden, setSidebarHidden] = useState(false)

  // Reset scroll position on route navigation
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // App-menu actions: Settings (⌘,) navigates, View ▸ Toggle Sidebar (⌘\) hides it.
  useEffect(() => {
    const offNav = window.api.onMenuNavigate((path) => navigate(path))
    const offToggle = window.api.onToggleSidebar(() => setSidebarHidden((h) => !h))
    return () => {
      offNav()
      offToggle()
    }
  }, [navigate])

  // Cmd/Ctrl+1..6 view navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // Don't steal Cmd/Ctrl+digit while typing in a field (matches useKeyboardShortcuts).
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= VIEW_PATHS.length) {
        e.preventDefault()
        navigate(VIEW_PATHS[n - 1])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  return (
    <div className="flex flex-1 overflow-hidden">
      {!sidebarHidden && <Sidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TitleBar />
        <main ref={mainRef} className="flex-1 overflow-y-auto px-10 py-9">
          {/* min-h-full (not h-full): full height so short pages can center
              vertically, but grows with tall pages so the py-9 top/bottom
              padding actually wraps the content instead of being overflowed. */}
          <div className="max-w-5xl mx-auto w-full min-h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
