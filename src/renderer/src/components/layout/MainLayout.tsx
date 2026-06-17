import { useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

interface MainLayoutProps {
  children: React.ReactNode
}

// Same order as the sidebar nav — Cmd/Ctrl+1..5 jumps between views (native tab feel).
const VIEW_PATHS = ['/', '/downloads', '/library', '/device', '/settings']

export function MainLayout({ children }: MainLayoutProps): JSX.Element {
  const mainRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigate = useNavigate()

  // Reset scroll position on route navigation
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // Cmd/Ctrl+1..5 view navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // Don't steal Cmd/Ctrl+digit while typing in a field (matches useKeyboardShortcuts).
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TitleBar />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
