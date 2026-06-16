import { useState, useCallback, useRef, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Track } from '../../../../shared/models'
import { formatDuration } from '../../../../shared/utils'
import { usePlayerStore } from '../../store/playerStore'
import { useLibraryStore, type SortField } from '../../store/libraryStore'
import { Checkbox } from '../ui/Checkbox'
import { ContextMenu } from '../ui/ContextMenu'
import { TrackDetailModal } from '../ui/TrackDetailModal'
import {
  FolderOpenIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'

interface TrackListProps {
  tracks: Track[]
}

interface LibraryTrackRowProps {
  track: Track
  index: number
  isCurrent: boolean
  isSelected: boolean
  confirmDeleteId: string | null
  onPlay: (index: number) => void
  onToggleSelection: (id: string, index: number) => void
  onShiftSelect: (index: number) => void
  onConfirmDelete: (id: string | null) => void
  onDeleteOne: (id: string) => void
  onOpenFolder: (path: string) => void
  onContextMenu: (e: React.MouseEvent, track: Track) => void
}

const LibraryTrackRow = memo(function LibraryTrackRow({
  track, index, isCurrent, isSelected, confirmDeleteId,
  onPlay, onToggleSelection, onShiftSelect, onConfirmDelete, onDeleteOne, onOpenFolder, onContextMenu
}: LibraryTrackRowProps) {
  const handleCheckboxClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (e.shiftKey) {
      onShiftSelect(index)
    } else {
      onToggleSelection(track.id, index)
    }
  }

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, track)}
      className={`flex items-center gap-4 px-4 py-2.5 rounded-[var(--radius-item)] transition group ${
        isCurrent
          ? 'bg-accent/10 text-accent border-l-2 border-accent'
          : 'hover:bg-glass-hover hover:translate-x-0.5'
      }`}
    >
      <Checkbox checked={isSelected} onChange={() => onToggleSelection(track.id, index)} onClick={handleCheckboxClick} />

      <button
        onClick={() => onPlay(index)}
        className="w-8 text-right text-xs text-text-muted hover:text-accent transition"
      >
        {index + 1}
      </button>

      <button
        onClick={() => onPlay(index)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <img
          src={track.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-9 h-9 rounded object-cover bg-bg-surface"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="min-w-0">
          <p className="text-sm truncate">{track.title}</p>
          <p className="text-xs text-text-muted truncate">{track.artist}</p>
        </div>
      </button>

      <span className="w-32 text-xs text-text-muted truncate">{track.playlistTitle}</span>
      <span className="w-16 text-right text-xs text-text-muted">
        {formatDuration(track.duration)}
      </span>
      <span className="w-14 text-right text-xs text-text-muted">
        {track.bitrate ? `${track.bitrate}kbps` : ''}
      </span>
      <span className="w-24 text-xs text-text-muted truncate">{track.genre || ''}</span>

      <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
        {track.filePath && (
          <button
            onClick={() => onOpenFolder(track.filePath!)}
            className="text-text-muted hover:text-accent transition p-1 rounded"
            title="Show in folder"
          >
            <FolderOpenIcon className="w-4 h-4" />
          </button>
        )}
        {confirmDeleteId === track.id ? (
          <div className="flex gap-0.5">
            <button
              onClick={() => onDeleteOne(track.id)}
              className="text-red-500 hover:text-red-400 transition p-1"
              title="Confirm delete"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onConfirmDelete(null)}
              className="text-text-muted hover:text-text-primary transition p-1"
              title="Cancel"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onConfirmDelete(track.id)}
            className="text-text-muted hover:text-red-500 transition p-1 rounded"
            title="Delete track"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  return (
    prev.track.id === next.track.id &&
    prev.isCurrent === next.isCurrent &&
    prev.isSelected === next.isSelected &&
    prev.index === next.index &&
    prev.confirmDeleteId === next.confirmDeleteId
  )
})

function SortHeader({ field, label, className }: { field: SortField; label: string; className?: string }): JSX.Element {
  const sortBy = useLibraryStore((s) => s.sortBy)
  const sortDirection = useLibraryStore((s) => s.sortDirection)
  const setSortBy = useLibraryStore((s) => s.setSortBy)
  const isActive = sortBy === field

  return (
    <button
      onClick={() => setSortBy(field)}
      className={`flex items-center gap-0.5 hover:text-text-primary transition ${className ?? ''} ${isActive ? 'text-accent' : ''}`}
    >
      {label}
      {isActive && (
        sortDirection === 'asc'
          ? <ChevronUpIcon className="w-3 h-3" />
          : <ChevronDownIcon className="w-3 h-3" />
      )}
    </button>
  )
}

export function TrackList({ tracks }: TrackListProps): JSX.Element {
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const play = usePlayerStore((s) => s.play)
  const selectedTrackIds = useLibraryStore((s) => s.selectedTrackIds)
  const toggleTrackSelection = useLibraryStore((s) => s.toggleTrackSelection)
  const shiftSelectTracks = useLibraryStore((s) => s.shiftSelectTracks)
  const deleteTracks = useLibraryStore((s) => s.deleteTracks)
  const openFolder = useLibraryStore((s) => s.openFolder)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null)
  const [detailTrack, setDetailTrack] = useState<Track | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5
  })

  const handlePlay = useCallback((index: number): void => {
    setQueue(tracks, index)
    play()
  }, [tracks, setQueue, play])

  const handleDeleteOne = useCallback(async (trackId: string): Promise<void> => {
    await deleteTracks([trackId])
    setConfirmDeleteId(null)
  }, [deleteTracks])

  const handleContextMenu = useCallback((e: React.MouseEvent, track: Track) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, track })
  }, [])

  const handleToggleSelection = useCallback((id: string, index: number) => {
    toggleTrackSelection(id, index)
  }, [toggleTrackSelection])

  const handleShiftSelect = useCallback((index: number) => {
    shiftSelectTracks(index, tracks)
  }, [shiftSelectTracks, tracks])

  const handleOpenFolder = useCallback((path: string) => {
    openFolder(path)
  }, [openFolder])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-text-muted uppercase tracking-wider border-b border-border-default">
        <span className="w-6"></span>
        <span className="w-8 text-right">#</span>
        <SortHeader field="title" label="Title" className="flex-1" />
        <SortHeader field="playlist" label="Playlist" className="w-32" />
        <SortHeader field="duration" label="Duration" className="w-16 justify-end" />
        <span className="w-14 text-right">Bitrate</span>
        <span className="w-24">Genre</span>
        <span className="w-20"></span>
      </div>

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const track = tracks[virtualRow.index]
            return (
              <div
                key={track.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <LibraryTrackRow
                  track={track}
                  index={virtualRow.index}
                  isCurrent={currentTrackId === track.id}
                  isSelected={selectedTrackIds.has(track.id)}
                  confirmDeleteId={confirmDeleteId}
                  onPlay={handlePlay}
                  onToggleSelection={handleToggleSelection}
                  onShiftSelect={handleShiftSelect}
                  onConfirmDelete={setConfirmDeleteId}
                  onDeleteOne={handleDeleteOne}
                  onOpenFolder={handleOpenFolder}
                  onContextMenu={handleContextMenu}
                />
              </div>
            )
          })}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'View Details',
              icon: <InformationCircleIcon className="w-4 h-4" />,
              onClick: () => setDetailTrack(contextMenu.track)
            },
            ...(contextMenu.track.filePath ? [{
              label: 'Show in Folder',
              icon: <FolderOpenIcon className="w-4 h-4" />,
              onClick: () => openFolder(contextMenu.track.filePath!)
            }] : []),
            {
              label: 'Delete Track',
              icon: <TrashIcon className="w-4 h-4" />,
              onClick: () => setConfirmDeleteId(contextMenu.track.id),
              danger: true
            }
          ]}
        />
      )}

      {detailTrack && (
        <TrackDetailModal track={detailTrack} onClose={() => setDetailTrack(null)} />
      )}
    </div>
  )
}
