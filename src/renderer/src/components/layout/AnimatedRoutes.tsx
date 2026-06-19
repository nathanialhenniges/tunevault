import { useRef, useEffect, useState, lazy, Suspense } from 'react'
import { useLocation, Routes, Route } from 'react-router-dom'
import { PlaylistView } from '../playlist/PlaylistView'
import { Loader } from '../ui/Loader'

const PlaylistsView = lazy(() => import('../playlist/PlaylistsView').then((m) => ({ default: m.PlaylistsView })))
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
      <Suspense fallback={<div className="flex-1 flex items-center justify-center py-24"><Loader size={76} /></div>}>
        <Routes location={displayLocation}>
          <Route path="/" element={<PlaylistView />} />
          <Route path="/playlists" element={<PlaylistsView />} />
          <Route path="/downloads" element={<DownloadQueue />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/device" element={<DeviceView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </Suspense>
    </div>
  )
}
