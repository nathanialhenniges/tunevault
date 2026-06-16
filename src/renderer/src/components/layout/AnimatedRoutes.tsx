import { useRef, useEffect, useState, lazy, Suspense } from 'react'
import { useLocation, Routes, Route } from 'react-router-dom'
import { PlaylistView } from '../playlist/PlaylistView'

const DownloadQueue = lazy(() => import('../download/DownloadQueue').then((m) => ({ default: m.DownloadQueue })))
const LibraryView = lazy(() => import('../library/LibraryView').then((m) => ({ default: m.LibraryView })))
const DeviceView = lazy(() => import('../device/DeviceView').then((m) => ({ default: m.DeviceView })))
const SettingsView = lazy(() => import('../settings/SettingsView').then((m) => ({ default: m.SettingsView })))

export function AnimatedRoutes(): JSX.Element {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit'>('enter')
  const prevKey = useRef(location.key)

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key
      setTransitionStage('exit')
    }
  }, [location])

  const handleAnimationEnd = (): void => {
    if (transitionStage === 'exit') {
      setDisplayLocation(location)
      setTransitionStage('enter')
    }
  }

  return (
    <div
      className={transitionStage === 'enter' ? 'route-enter' : 'route-exit'}
      onAnimationEnd={handleAnimationEnd}
    >
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-text-muted text-sm">Loading...</div>}>
        <Routes location={displayLocation}>
          <Route path="/" element={<PlaylistView />} />
          <Route path="/downloads" element={<DownloadQueue />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/device" element={<DeviceView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </Suspense>
    </div>
  )
}
