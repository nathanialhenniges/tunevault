import { useState, useMemo } from 'react'
import { useDownloadStore } from '../../store/downloadStore'
import { usePlaylistStore } from '../../store/playlistStore'
import { useDownload } from '../../hooks/useDownload'
import { DownloadItem } from './DownloadItem'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import { ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

export function DownloadQueue(): JSX.Element {
  const downloads = useDownloadStore((s) => s.downloads)
  const isDownloading = useDownloadStore((s) => s.isDownloading)
  const clear = useDownloadStore((s) => s.clear)
  const cancelAll = useDownloadStore((s) => s.cancelAll)
  const playlist = usePlaylistStore((s) => s.currentPlaylist)
  const { startDownload } = useDownload()
  const [showRedownloadConfirm, setShowRedownloadConfirm] = useState(false)

  // Single-pass stats computation
  const { entries, doneCount, skippedCount, errorCount, activeCount } = useMemo(() => {
    const e = Array.from(downloads.entries())
    let done = 0, skipped = 0, error = 0, active = 0
    for (const [, d] of e) {
      if (d.status === 'done') done++
      else if (d.status === 'skipped') skipped++
      else if (d.status === 'error') error++
      else active++
    }
    return { entries: e, doneCount: done, skippedCount: skipped, errorCount: error, activeCount: active }
  }, [downloads])

  const handleRedownload = async (): Promise<void> => {
    setShowRedownloadConfirm(false)
    clear()
    await startDownload(undefined, true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Downloads"
        subtitle={
          entries.length > 0 ? (
            <>
              {doneCount} of {entries.length} complete
              {skippedCount > 0 && ` · ${skippedCount} skipped`}
              {errorCount > 0 && ` · ${errorCount} failed`}
            </>
          ) : undefined
        }
        actions={
          (isDownloading ? activeCount > 0 : entries.length > 0) ? (
          <>
            {isDownloading && activeCount > 0 && (
              <button
                onClick={cancelAll}
                className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition"
              >
                Cancel All
              </button>
            )}

            {!isDownloading && entries.length > 0 && playlist && (
              <button
                onClick={() => setShowRedownloadConfirm(true)}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                Redownload All
              </button>
            )}

            {!isDownloading && entries.length > 0 && (
              <button
                onClick={clear}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
              >
                Clear
              </button>
            )}
          </>
          ) : undefined
        }
      />

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-25" style={{ background: 'var(--accent)' }} />
            <ArrowDownTrayIcon className="relative w-12 h-12 text-accent opacity-80" />
          </div>
          <p className="text-base font-medium text-text-primary">No downloads in progress</p>
          <p className="text-sm text-text-secondary mt-1 max-w-xs">Fetch a playlist and click “Download All” to start.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(([trackId, progress]) => {
            const track = playlist?.tracks.find((t) => t.id === trackId)
            if (!track) return null
            return <DownloadItem key={trackId} track={track} progress={progress} />
          })}
        </div>
      )}

      <Modal open={showRedownloadConfirm} onClose={() => setShowRedownloadConfirm(false)} className="p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">Redownload All Tracks?</h3>
        <p className="text-sm text-text-secondary mb-6">
          This will re-download all {playlist?.tracks.length ?? 0} tracks and overwrite the existing files on disk.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowRedownloadConfirm(false)}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleRedownload}
            className="px-4 py-2 text-sm text-text-inverted bg-accent hover:bg-accent-hover rounded-lg transition"
          >
            Redownload All
          </button>
        </div>
      </Modal>
    </div>
  )
}
