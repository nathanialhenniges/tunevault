import { memo } from 'react'
import type { DownloadProgress, Track } from '../../../../shared/models'
import { ProgressBar } from './ProgressBar'
import { AlbumArt } from '../ui/AlbumArt'
import { useDownloadStore } from '../../store/downloadStore'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface DownloadItemProps {
  track: Track
  progress?: DownloadProgress
}

const statusLabels: Record<string, string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  converting: 'Converting',
  tagging: 'Tagging',
  done: 'Complete',
  skipped: 'Skipped',
  error: 'Error'
}

export const DownloadItem = memo(function DownloadItem({ track, progress }: DownloadItemProps): JSX.Element {
  const cancelOne = useDownloadStore((s) => s.cancelOne)
  const status = progress?.status ?? 'queued'
  const percent = progress?.percent ?? 0
  const canCancel = status === 'queued' || status === 'downloading' || status === 'converting'

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-[var(--radius-item)] hover:bg-glass-hover transition group">
      <AlbumArt src={track.thumbnailUrl} className="w-10 h-10" />

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm truncate">{track.title}</p>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                status === 'done'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : status === 'skipped'
                    ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                    : status === 'error'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-bg-surface text-text-secondary'
              }`}
            >
              {statusLabels[status] ?? status}
            </span>
          </div>
        </div>

        <ProgressBar percent={percent} status={status} />

        {status === 'downloading' && progress && (
          <div className="flex gap-3 text-xs text-text-muted">
            <span>{Math.round(percent)}%</span>
            {progress.speed && <span>{progress.speed}</span>}
            {progress.eta && <span>ETA {progress.eta}</span>}
          </div>
        )}

        {status === 'error' && progress?.error && (
          <p className="text-xs text-red-600 dark:text-red-400 truncate">{progress.error}</p>
        )}
      </div>

      {canCancel && (
        <button
          onClick={() => cancelOne(track.id)}
          className="text-text-muted hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1 rounded"
          title="Cancel download"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}, (prev, next) => {
  return (
    prev.track.id === next.track.id &&
    prev.progress?.status === next.progress?.status &&
    prev.progress?.percent === next.progress?.percent &&
    prev.progress?.speed === next.progress?.speed &&
    prev.progress?.eta === next.progress?.eta &&
    prev.progress?.error === next.progress?.error
  )
})
