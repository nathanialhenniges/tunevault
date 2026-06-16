import { useCallback, useEffect, useState, useRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { AnimatedRoutes } from './components/layout/AnimatedRoutes'
import { PlayerBar } from './components/player/PlayerBar'
import { useSettingsStore } from './store/settingsStore'
import { useLibraryStore } from './store/libraryStore'
import { useDownloadStore } from './store/downloadStore'
import { usePlayer } from './hooks/usePlayer'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePlayerStore } from './store/playerStore'
import { usePlaylistStore } from './store/playlistStore'
import { useKonamiCode } from './hooks/useKonamiCode'
import { useWolfModeStore } from './hooks/useWolfMode'
import { DisclaimerModal } from './components/ui/DisclaimerModal'
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal'
import { ToastContainer } from './components/ui/ToastContainer'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { Visualizer } from './components/player/Visualizer'
import { useVisualizerStore } from './store/visualizerStore'
import { useSyncStore } from './store/syncStore'
import { toast } from './store/toastStore'

export default function App(): JSX.Element {
  const loadSettings = useSettingsStore((s) => s.load)
  const loadLibrary = useLibraryStore((s) => s.load)
  const visualizerEnabled = useVisualizerStore((s) => s.enabled)
  const visualizerStyle = useVisualizerStore((s) => s.style)
  const setProgress = useDownloadStore((s) => s.setProgress)
  const setComplete = useDownloadStore((s) => s.setComplete)
  const setError = useDownloadStore((s) => s.setError)
  const [dragOver, setDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  usePlayer()
  useKeyboardShortcuts()

  const unlockWolf = useWolfModeStore((s) => s.unlock)
  useKonamiCode(useCallback(() => unlockWolf(), [unlockWolf]))

  useEffect(() => {
    loadSettings()
    loadLibrary()

    const unsubProgress = window.api.onDownloadProgress(setProgress)
    const unsubComplete = window.api.onDownloadComplete((data) => {
      setComplete(data.trackId)
      loadLibrary()
    })
    const unsubError = window.api.onDownloadError((data) => {
      setError(data.trackId, data.error)
    })

    const unsubSyncResult = window.api.onSyncResult((result) => {
      useSyncStore.getState().addResult(result)
    })
    const unsubSyncStatus = window.api.onSyncStatus((status) => {
      useSyncStore.getState().setSyncing(status.syncing)
      if (status.message) {
        if (status.syncing) {
          toast.info(status.message)
        } else {
          toast.success(status.message)
        }
      }
    })

    const unsubToggle = window.api.onTrayTogglePlay(() => {
      usePlayerStore.getState().togglePlay()
    })
    const unsubNext = window.api.onTrayNext(() => {
      usePlayerStore.getState().next()
    })
    const unsubPrev = window.api.onTrayPrev(() => {
      usePlayerStore.getState().prev()
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
      unsubSyncResult()
      unsubSyncStatus()
      unsubToggle()
      unsubNext()
      unsubPrev()
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    // Dropped local files/folders -> import into the library.
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) {
      const paths = files.map((f) => window.api.pathForFile(f)).filter(Boolean)
      if (paths.length) {
        window.api
          .importPaths(paths)
          .then((r) => {
            if (r.imported > 0) {
              useLibraryStore.getState().load()
              toast.success(`Imported ${r.imported} tracks into ${r.playlists} playlist(s)`)
            } else {
              toast.error('No audio files found to import')
            }
          })
          .catch((err) => toast.error((err as Error).message))
        return
      }
    }

    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (text && /[?&]list=/.test(text)) {
      const url = text.trim().split('\n')[0]
      usePlaylistStore.getState().setPendingUrl(url)
      usePlaylistStore.getState().fetchPlaylist(url)
    }
  }, [])

  return (
    <MemoryRouter>
      <div
        className="flex flex-col h-screen bg-transparent text-text-primary transition-colors duration-200"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <MainLayout>
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </MainLayout>
        <Visualizer enabled={visualizerEnabled} style={visualizerStyle} />
        <PlayerBar />
        <DisclaimerModal />
        <KeyboardShortcutsModal />
        <ToastContainer />

        {dragOver && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 pointer-events-none" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
            <div className="border-2 border-dashed border-accent rounded-2xl px-12 py-8 text-accent text-lg font-semibold">
              Drop a playlist URL, or audio files / folders to import
            </div>
          </div>
        )}
      </div>
    </MemoryRouter>
  )
}
