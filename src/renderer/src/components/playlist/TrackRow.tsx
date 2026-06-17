import { memo } from 'react'
import type { Track, DownloadProgress, TrackDensity } from '../../../../shared/models'
import { formatDuration } from '../../../../shared/utils'
import { usePlayerStore } from '../../store/playerStore'
import { Checkbox } from '../ui/Checkbox'
import { AlbumArt } from '../ui/AlbumArt'
import { PlayIcon } from '@heroicons/react/24/solid'
import {
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ExclamationCircleIcon,
  ForwardIcon
} from '@heroicons/react/24/outline'

interface TrackRowProps {
  track: Track
  index: number
  tracks: Track[]
  selected?: boolean
  density?: TrackDensity
  onToggleSelect?: () => void
  downloadProgress?: DownloadProgress
  onContextMenu?: (e: React.MouseEvent, track: Track) => void
}

function DownloadStatus({ progress }: { progress: DownloadProgress }): JSX.Element {
  switch (progress.status) {
    case 'done':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />
    case 'skipped':
      return <ForwardIcon className="w-4 h-4 text-yellow-500" />
    case 'error':
      return (
        <span title={progress.error}>
          <ExclamationCircleIcon className="w-4 h-4 text-red-500" />
        </span>
      )
    case 'downloading':
    case 'converting':
    case 'tagging':
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 bg-bg-inset rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress.percent, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted w-7 text-right">
            {Math.round(progress.percent)}%
          </span>
        </div>
      )
    case 'rate-limited':
      return (
        <span title={progress.error} className="text-[10px] text-yellow-500 animate-pulse">
          Rate limited
        </span>
      )
    case 'queued':
      return <ArrowDownTrayIcon className="w-3.5 h-3.5 text-text-muted animate-pulse" />
    default:
      return <></>
  }
}

export const TrackRow = memo(function TrackRow({ track, index, tracks, selected, density, onToggleSelect, downloadProgress, onContextMenu }: TrackRowProps): JSX.Element {
  const dense = density === 'compact'
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const play = usePlayerStore((s) => s.play)
  const isCurrent = currentTrack?.id === track.id

  const handlePlay = (): void => {
    if (!track.filePath) return
    const playableTracks = tracks.filter((t) => t.filePath)
    const startIdx = playableTracks.findIndex((t) => t.id === track.id)
    setQueue(playableTracks, startIdx >= 0 ? startIdx : 0)
    play()
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    onContextMenu?.(e, track)
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`flex items-center gap-4 px-4 ${dense ? 'py-1' : 'py-2.5'} rounded-[var(--radius-item)] transition group ${
        isCurrent
          ? 'bg-accent/10 text-accent border-l-2 border-accent'
          : track.filePath
            ? 'hover:bg-glass-hover cursor-pointer'
            : 'hover:bg-glass-hover'
      }`}
    >
      {onToggleSelect !== undefined && (
        <Checkbox checked={selected ?? false} onChange={onToggleSelect} />
      )}

      <button
        type="button"
        onClick={handlePlay}
        disabled={!track.filePath}
        aria-label={track.filePath ? `Play ${track.title}` : track.title}
        className="flex items-center gap-4 flex-1 min-w-0 text-left"
      >
        <span className="w-6 text-right text-xs text-text-muted shrink-0">{track.position}</span>
        <AlbumArt src={track.thumbnailUrl} className={dense ? 'w-8 h-8' : 'w-10 h-10'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{track.title}</p>
          <p className="text-xs text-text-muted truncate">{track.artist}</p>
        </div>
      </button>

      <span className="text-xs text-text-muted">{formatDuration(track.duration)}</span>

      {track.bitrate && (
        <span className="text-xs text-text-muted">{track.bitrate}kbps</span>
      )}

      {downloadProgress ? (
        <div className="w-20 flex justify-end">
          <DownloadStatus progress={downloadProgress} />
        </div>
      ) : track.filePath ? (
        <span className="w-20 flex justify-end text-accent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
          <PlayIcon className="w-4 h-4" />
        </span>
      ) : (
        <span className="w-20" />
      )}
    </div>
  )
}, (prev, next) => {
  return (
    prev.track.id === next.track.id &&
    prev.selected === next.selected &&
    prev.index === next.index &&
    prev.density === next.density &&
    prev.downloadProgress?.status === next.downloadProgress?.status &&
    prev.downloadProgress?.percent === next.downloadProgress?.percent
  )
})
