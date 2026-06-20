import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Track } from '../../../../shared/models'
import { formatDuration } from '../../../../shared/utils'
import { usePlayerStore } from '../../store/playerStore'
import { useLibraryStore, type SortField } from '../../store/libraryStore'
import { useSettingsStore } from '../../store/settingsStore'
import type { TrackDensity } from '../../../../shared/models'
import { Checkbox } from '../ui/Checkbox'
import { ContextMenu } from '../ui/ContextMenu'
import { TrackDetailModal } from '../ui/TrackDetailModal'
import { AlbumArt } from '../ui/AlbumArt'
import { Modal } from '../ui/Modal'
import { EditMetadataModal } from './EditMetadataModal'
import {
  FolderOpenIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  QueueListIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline'

interface TrackListProps {
  tracks: Track[]
}

/** Fixed row heights (px) per density. The row fills this exactly (h-full). */
const ROW_HEIGHT: Record<TrackDensity, number> = { comfortable: 56, compact: 44 }

interface LibraryTrackRowProps {
  track: Track
  index: number
  isCurrent: boolean
  isSelected: boolean
  density: TrackDensity
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
  track, index, isCurrent, isSelected, density, confirmDeleteId,
  onPlay, onToggleSelection, onShiftSelect, onConfirmDelete, onDeleteOne, onOpenFolder, onContextMenu
}: LibraryTrackRowProps) {
  const dense = density === 'compact'
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
      className={`h-full flex items-center gap-4 px-4 transition group ${
        isCurrent
          ? 'bg-accent/10 text-accent'
          : 'hover:bg-glass-hover'
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
        <AlbumArt src={track.thumbnailUrl} className={dense ? 'w-8 h-8' : 'w-9 h-9'} />
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
            className="text-text-muted hover:text-accent transition p-1.5 rounded"
            title="Show in folder"
          >
            <FolderOpenIcon className="w-4 h-4" />
          </button>
        )}
        {confirmDeleteId === track.id ? (
          <div className="flex gap-0.5">
            <button
              onClick={() => onDeleteOne(track.id)}
              className="text-red-500 hover:text-red-400 transition p-1.5"
              title="Confirm delete"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onConfirmDelete(null)}
              className="text-text-muted hover:text-text-primary transition p-1.5"
              title="Cancel"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onConfirmDelete(track.id)}
            className="text-text-muted hover:text-red-500 transition p-1.5 rounded"
            title="Delete track"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  const a = prev.track
  const b = next.track
  return (
    a.id === b.id &&
    // Re-render when any rendered field changes (live metadata patches, reloads).
    a.title === b.title &&
    a.artist === b.artist &&
    a.genre === b.genre &&
    a.thumbnailUrl === b.thumbnailUrl &&
    a.playlistTitle === b.playlistTitle &&
    a.duration === b.duration &&
    a.bitrate === b.bitrate &&
    a.filePath === b.filePath &&
    prev.isCurrent === next.isCurrent &&
    prev.isSelected === next.isSelected &&
    prev.index === next.index &&
    prev.density === next.density &&
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
  const moveTracks = useLibraryStore((s) => s.moveTracks)
  const setMetadata = useLibraryStore((s) => s.setMetadata)
  const playlists = useLibraryStore((s) => s.library.playlists)
  const openFolder = useLibraryStore((s) => s.openFolder)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null)
  const [detailTrack, setDetailTrack] = useState<Track | null>(null)
  // Tracks queued for a "move to playlist" action (the right-clicked track, plus
  // the rest of the selection when it's part of a multi-select).
  const [moveTargets, setMoveTargets] = useState<Track[] | null>(null)
  const [editTargets, setEditTargets] = useState<Track[] | null>(null)
  const density = useSettingsStore((s) => s.settings.trackDensity)
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    // Rows are a fixed height per density (the inner row fills its slot via
    // h-full), so the estimate IS the real height — no dynamic measurement,
    // no drift between a row's draw position and its hover hit-area.
    estimateSize: () => ROW_HEIGHT[density],
    overscan: 6
  })

  // Re-measure when the density setting changes.
  useEffect(() => {
    rowVirtualizer.measure()
  }, [density, rowVirtualizer])

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

  const openMove = useCallback((track: Track) => {
    // If the track is part of a multi-selection, move the whole selection.
    if (selectedTrackIds.has(track.id) && selectedTrackIds.size > 1) {
      setMoveTargets(tracks.filter((t) => selectedTrackIds.has(t.id)))
    } else {
      setMoveTargets([track])
    }
  }, [selectedTrackIds, tracks])

  const handleMove = useCallback(async (targetPlaylistId: string) => {
    if (!moveTargets) return
    await moveTracks(moveTargets.map((t) => t.id), targetPlaylistId)
    setMoveTargets(null)
  }, [moveTargets, moveTracks])

  const openEdit = useCallback((track: Track) => {
    // Edit the whole selection when the track is part of a multi-select.
    if (selectedTrackIds.has(track.id) && selectedTrackIds.size > 1) {
      setEditTargets(tracks.filter((t) => selectedTrackIds.has(t.id)))
    } else {
      setEditTargets([track])
    }
  }, [selectedTrackIds, tracks])

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
      {/* Header — title-case to match the sortable <button> labels (which reset
          text-transform), so columns read uniformly like a native list view. */}
      <div className="flex items-center gap-4 px-4 pb-2.5 text-[11px] font-medium text-text-muted tracking-wide border-b border-border-default">
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
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
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
                  density={density}
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
            {
              label: selectedTrackIds.has(contextMenu.track.id) && selectedTrackIds.size > 1
                ? `Edit Metadata (${selectedTrackIds.size})`
                : 'Edit Metadata',
              icon: <PencilSquareIcon className="w-4 h-4" />,
              onClick: () => openEdit(contextMenu.track)
            },
            ...(playlists.length > 1 ? [{
              label: selectedTrackIds.has(contextMenu.track.id) && selectedTrackIds.size > 1
                ? `Move ${selectedTrackIds.size} to Playlist…`
                : 'Move to Playlist…',
              icon: <QueueListIcon className="w-4 h-4" />,
              onClick: () => openMove(contextMenu.track)
            }] : []),
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
        <TrackDetailModal
          track={detailTrack}
          onClose={() => setDetailTrack(null)}
          onSave={(patch) => setMetadata([detailTrack.id], patch)}
        />
      )}

      {editTargets && (
        <EditMetadataModal
          tracks={editTargets}
          onClose={() => setEditTargets(null)}
          onSave={(patch) => setMetadata(editTargets.map((t) => t.id), patch)}
        />
      )}

      {/* Move to Playlist picker */}
      <Modal open={!!moveTargets} onClose={() => setMoveTargets(null)} className="p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold mb-1">Move to Playlist</h3>
        <p className="text-sm text-text-secondary mb-4">
          Move {moveTargets?.length ?? 0} track{(moveTargets?.length ?? 0) === 1 ? '' : 's'} to:
        </p>
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {(() => {
            // Hide the source playlist when every selected track shares it.
            const srcIds = new Set(moveTargets?.map((t) => t.playlistId))
            const onlySource = srcIds.size === 1 ? [...srcIds][0] : null
            return playlists
              .filter((p) => p.id !== onlySource)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleMove(p.id)}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-left rounded-lg text-text-secondary hover:bg-glass-hover hover:text-text-primary transition"
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs text-text-muted shrink-0">{p.tracks.length}</span>
                </button>
              ))
          })()}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={() => setMoveTargets(null)}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  )
}
