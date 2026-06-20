import { useMemo, useState, useEffect } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { formatDuration } from '../../../../shared/utils'
import { Modal } from '../ui/Modal'
import { AlbumArt } from '../ui/AlbumArt'
import {
  XMarkIcon,
  FolderOpenIcon,
  ClockIcon,
  MusicalNoteIcon,
  CodeBracketIcon,
  ListBulletIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'

type ViewMode = 'pretty' | 'markdown'

interface PlaylistInfoModalProps {
  playlistId: string
  onClose: () => void
}

export function PlaylistInfoModal({ playlistId, onClose }: PlaylistInfoModalProps): JSX.Element {
  const library = useLibraryStore((s) => s.library)
  const [viewMode, setViewMode] = useState<ViewMode>('pretty')
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [infoFilePath, setInfoFilePath] = useState<string | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)

  const playlist = useMemo(
    () => library.playlists.find((p) => p.id === playlistId),
    [library, playlistId]
  )

  const downloadedTracks = useMemo(() => {
    if (!playlist) return []
    return [...playlist.tracks]
      .filter((t) => t.filePath)
      .sort((a, b) => a.position - b.position)
  }, [playlist])

  const totalDuration = useMemo(
    () => downloadedTracks.reduce((sum, t) => sum + t.duration, 0),
    [downloadedTracks]
  )

  // Load markdown content and file path on mount
  useEffect(() => {
    let cancelled = false
    setLoadingInfo(true)
    Promise.all([
      window.api.readPlaylistInfo(playlistId),
      window.api.getPlaylistInfoPath(playlistId)
    ])
      .then(([content, path]) => {
        if (cancelled) return
        setMarkdownContent(content)
        setInfoFilePath(path)
      })
      .catch(() => {
        // Leave content/path null — the markdown view shows its fallback text.
      })
      .finally(() => {
        if (!cancelled) setLoadingInfo(false)
      })
    return () => {
      cancelled = true
    }
  }, [playlistId])

  const handleOpenFolder = async (): Promise<void> => {
    if (infoFilePath) await window.api.openFolder(infoFilePath)
  }

  const handleOpenInEditor = async (): Promise<void> => {
    if (infoFilePath) await window.api.openFile(infoFilePath)
  }

  if (!playlist) return <Modal open={true} onClose={onClose} className="p-6 max-w-md mx-4"><p className="text-text-secondary">Playlist not found.</p></Modal>

  const totalDurationMinutes = Math.floor(totalDuration / 60)
  const totalDurationFormatted = totalDurationMinutes >= 60
    ? `${Math.floor(totalDurationMinutes / 60)}h ${totalDurationMinutes % 60}m`
    : `${totalDurationMinutes}m`

  return (
    <Modal open={true} onClose={onClose} className="max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 pb-4">
        <AlbumArt src={playlist.thumbnailUrl} className="w-20 h-20" radius="0.5rem" />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold truncate">{playlist.title}</h2>
          <p className="text-sm text-text-secondary truncate">{playlist.channelTitle}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <MusicalNoteIcon className="w-3.5 h-3.5" />
              {downloadedTracks.length} track{downloadedTracks.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {totalDurationFormatted}
            </span>
            {playlist.fetchedAt && (
              <span>
                Fetched {new Date(playlist.fetchedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* View toggle + close */}
        <div className="flex items-center gap-1 shrink-0">
          {markdownContent && (
            <div className="flex items-center border border-[var(--glass-border-edge)] rounded-lg overflow-hidden mr-1">
              <button
                onClick={() => setViewMode('pretty')}
                className={`p-1.5 transition ${viewMode === 'pretty' ? 'bg-glass-active text-accent' : 'text-text-muted hover:text-text-primary hover:bg-glass-hover'}`}
                title="Pretty view"
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('markdown')}
                className={`p-1.5 transition ${viewMode === 'markdown' ? 'bg-glass-active text-accent' : 'text-text-muted hover:text-text-primary hover:bg-glass-hover'}`}
                title="Markdown view"
              >
                <CodeBracketIcon className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary transition rounded-lg hover:bg-glass-hover"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-2">
        {viewMode === 'pretty' ? (
          downloadedTracks.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">No downloaded tracks in this playlist.</p>
          ) : (
            <div className="space-y-0.5">
              {downloadedTracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-glass-hover transition"
                >
                  <span className="w-6 text-right text-xs text-text-muted tabular-nums shrink-0">
                    {track.position}
                  </span>
                  <AlbumArt src={track.thumbnailUrl} className="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{track.title}</p>
                    <p className="text-xs text-text-muted truncate">{track.artist}</p>
                  </div>
                  <span className="text-xs text-text-muted tabular-nums shrink-0">
                    {formatDuration(track.duration)}
                  </span>
                  {track.bitrate && (
                    <span className="text-xs text-text-muted tabular-nums shrink-0 w-14 text-right">
                      {track.bitrate}kbps
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-glass-hover border border-[var(--glass-border-edge)] rounded-lg p-4">
            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
              {loadingInfo ? 'Loading…' : markdownContent ?? 'No playlist-info.md file found.'}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-6 pt-4 shrink-0">
        {infoFilePath && (
          <>
            <button
              onClick={handleOpenInEditor}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              Open in Editor
            </button>
            <button
              onClick={handleOpenFolder}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
            >
              <FolderOpenIcon className="w-3.5 h-3.5" />
              Open Folder
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
