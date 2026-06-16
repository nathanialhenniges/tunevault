import { useEffect, useState, useMemo } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { useShallow } from 'zustand/react/shallow'
import { SearchBar } from './SearchBar'
import { TrackList } from './TrackList'
import {
  ArrowPathIcon,
  TrashIcon,
  FunnelIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
  MusicalNoteIcon,
  ArrowDownTrayIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/outline'
import { useSettingsStore } from '../../store/settingsStore'
import { useSyncStore } from '../../store/syncStore'
import { useLocation } from 'react-router-dom'
import { Modal } from '../ui/Modal'
import { PlaylistInfoModal } from './PlaylistInfoModal'
import { toast } from '../../store/toastStore'

export function LibraryView(): JSX.Element {
  const { load, selectAllTracks, clearSelection, deleteTracks, deleteAll, openFolder } = useLibraryStore(useShallow((s) => ({
    load: s.load,
    selectAllTracks: s.selectAllTracks,
    clearSelection: s.clearSelection,
    deleteTracks: s.deleteTracks,
    deleteAll: s.deleteAll,
    openFolder: s.openFolder
  })))
  const loaded = useLibraryStore((s) => s.loaded)
  const library = useLibraryStore((s) => s.library)
  const selectedTrackIds = useLibraryStore((s) => s.selectedTrackIds)
  const searchQuery = useLibraryStore((s) => s.searchQuery)
  const sortBy = useLibraryStore((s) => s.sortBy)
  const sortDirection = useLibraryStore((s) => s.sortDirection)
  const getFilteredTracks = useLibraryStore((s) => s.getFilteredTracks)
  const settings = useSettingsStore((s) => s.settings)
  const syncing = useSyncStore((s) => s.syncing)
  const pendingResults = useSyncStore((s) => s.pendingResults)
  const dismissResult = useSyncStore((s) => s.dismissResult)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false)
  const [showPlaylistInfo, setShowPlaylistInfo] = useState(false)
  const [playlistFilter, setPlaylistFilter] = useState<string>('all')
  const [fetchingGenres, setFetchingGenres] = useState(false)
  const devices = useSettingsStore((s) => s.settings.devices)
  const toggleDevicePlaylist = useSettingsStore((s) => s.toggleDevicePlaylist)
  const location = useLocation()

  useEffect(() => {
    if (!loaded) load()
  }, [loaded])

  // Auto-apply playlist filter from navigation state
  useEffect(() => {
    const state = location.state as { playlistFilter?: string } | null
    if (state?.playlistFilter) {
      setPlaylistFilter(state.playlistFilter)
    } else {
      setPlaylistFilter('all')
    }
  }, [location.state])

  // Memoize filtered tracks to avoid recomputing on unrelated re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allTracks = useMemo(() => getFilteredTracks(), [library, searchQuery, sortBy, sortDirection])
  const tracks = playlistFilter === 'all'
    ? allTracks
    : allTracks.filter((t) => t.playlistId === playlistFilter)
  const hasSelection = selectedTrackIds.size > 0
  const allSelected = tracks.length > 0 && selectedTrackIds.size === tracks.length

  const handleDeleteSelected = async (): Promise<void> => {
    await deleteTracks(Array.from(selectedTrackIds))
    setShowDeleteSelectedConfirm(false)
  }

  const handleDeleteAll = async (): Promise<void> => {
    if (playlistFilter !== 'all') {
      // Only delete tracks visible under the current playlist filter
      await deleteTracks(tracks.map((t) => t.id))
    } else {
      await deleteAll()
    }
    setShowDeleteAllConfirm(false)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold font-display">Library</h2>
            <p className="text-sm text-text-secondary mt-1">
              {tracks.length} tracks · {library.playlists.length} playlists
            </p>
          </div>
          <SearchBar />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
            title="Reload library"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Reload
          </button>
          <button
            onClick={() => window.api.syncCheckNow()}
            disabled={syncing}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Check for new tracks in synced playlists"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
          {settings.musicDir && (
            <button
              onClick={() => openFolder(settings.musicDir)}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              title="Open music folder"
            >
              <FolderOpenIcon className="w-3.5 h-3.5" />
              Open Folder
            </button>
          )}
          {library.playlists.length > 0 && (
            <button
              onClick={async () => {
                const ids =
                  playlistFilter !== 'all' ? [playlistFilter] : library.playlists.map((p) => p.id)
                setFetchingGenres(true)
                try {
                  const r = await window.api.fetchGenres(ids)
                  await load()
                  toast.success(`Genre found for ${r.updated} tracks (${r.tagged} files tagged)`)
                } catch (e) {
                  toast.error((e as Error).message)
                } finally {
                  setFetchingGenres(false)
                }
              }}
              disabled={fetchingGenres}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5 disabled:opacity-50"
              title="Look up genre for tracks (MusicBrainz) and tag the files"
            >
              <MusicalNoteIcon className={`w-3.5 h-3.5 ${fetchingGenres ? 'animate-pulse' : ''}`} />
              {fetchingGenres ? 'Fetching Genres…' : 'Fetch Genres'}
            </button>
          )}

          {/* Playlist filter */}
          {library.playlists.length > 0 && (
            <div className="relative flex items-center gap-1.5 ml-1">
              <FunnelIcon className="w-3.5 h-3.5 text-text-muted" />
              <select
                value={playlistFilter}
                onChange={(e) => setPlaylistFilter(e.target.value)}
                className="appearance-none border border-[var(--glass-border-edge)] rounded-lg px-3 py-1.5 pr-7 text-xs text-text-secondary hover:text-text-primary focus:outline-none focus:border-accent cursor-pointer transition"
                style={{ background: 'var(--glass-input-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
              >
                <option value="all">All Playlists</option>
                {library.playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.title} ({pl.tracks.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Playlist Info — only when a specific playlist is selected */}
          {playlistFilter !== 'all' && (
            <>
              <button
                onClick={() => setShowPlaylistInfo(true)}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
                title="View playlist info"
              >
                <DocumentTextIcon className="w-3.5 h-3.5" />
                Playlist Info
              </button>
              <button
                onClick={async () => {
                  await window.api.syncTogglePlaylist(playlistFilter)
                  await useSettingsStore.getState().load()
                }}
                className={`px-3 py-1.5 text-xs border rounded-lg transition-all flex items-center gap-1.5 ${
                  settings.sync.syncedPlaylistIds.includes(playlistFilter)
                    ? 'text-accent border-accent/40 bg-accent/10'
                    : 'text-text-secondary border-border-default hover:text-accent hover:border-accent/40 hover:bg-accent/5'
                }`}
                title="Toggle auto-sync for this playlist"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                {settings.sync.syncedPlaylistIds.includes(playlistFilter) ? 'Auto-Sync On' : 'Auto-Sync Off'}
              </button>
              {devices.length > 0 && (
                <div className="relative flex items-center gap-1.5">
                  <DevicePhoneMobileIcon className="w-3.5 h-3.5 text-text-muted" />
                  <select
                    value=""
                    onChange={(e) => {
                      const d = devices.find((x) => x.id === e.target.value)
                      if (!d) return
                      const has = d.playlistIds.includes(playlistFilter)
                      toggleDevicePlaylist(d.id, playlistFilter)
                      toast.success(has ? `Removed from ${d.name}` : `Added to ${d.name}`)
                    }}
                    className="appearance-none border border-[var(--glass-border-edge)] rounded-lg px-3 py-1.5 pr-7 text-xs text-text-secondary hover:text-text-primary focus:outline-none focus:border-accent cursor-pointer transition"
                    style={{ background: 'var(--glass-input-bg)' }}
                    title="Add this playlist to a device"
                  >
                    <option value="">Add to Device…</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.playlistIds.includes(playlistFilter) ? `✓ ${d.name}` : d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Selection / delete actions */}
          {tracks.length > 0 && (
            <>
              <button
                onClick={allSelected ? clearSelection : selectAllTracks}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center gap-1.5"
              >
                {allSelected ? (
                  <><XMarkIcon className="w-3.5 h-3.5" /> Deselect All</>
                ) : (
                  <><CheckIcon className="w-3.5 h-3.5" /> Select All</>
                )}
              </button>

              {hasSelection && (
                <button
                  onClick={() => setShowDeleteSelectedConfirm(true)}
                  className="px-3 py-1.5 text-xs text-red-400 border border-red-500/25 rounded-lg hover:bg-red-500/10 hover:border-red-500/40 transition-all flex items-center gap-1.5"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Delete {selectedTrackIds.size}
                </button>
              )}

              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="px-3 py-1.5 text-xs text-red-400 border border-red-500/25 rounded-lg hover:bg-red-500/10 hover:border-red-500/40 transition-all flex items-center gap-1.5"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                {playlistFilter !== 'all' ? `Delete All ${tracks.length}` : 'Delete All'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pending sync results banners */}
      {pendingResults.map((result) => (
        <div
          key={result.playlistId}
          className="flex items-center gap-3 px-4 py-3 bg-accent/10 border border-accent/30 rounded-lg"
        >
          <ArrowDownTrayIcon className="w-5 h-5 text-accent shrink-0" />
          <span className="text-sm flex-1">
            <strong>{result.newTracks.length}</strong> new track{result.newTracks.length !== 1 ? 's' : ''} in{' '}
            <strong>{result.playlistTitle}</strong>
          </span>
          <button
            onClick={() => {
              const playlist = library.playlists.find((p) => p.id === result.playlistId)
              if (playlist) {
                window.api.startDownload({
                  playlist: { ...playlist, tracks: result.newTracks },
                  format: settings.audioFormat,
                  outputDir: settings.musicDir,
                  concurrency: settings.concurrency,
                  dateFormat: settings.dateFormat,
                  releaseDateSource: settings.releaseDateSource
                })
              }
              dismissResult(result.playlistId)
            }}
            className="px-3 py-1 text-xs font-medium text-accent border border-accent/40 rounded-lg hover:bg-accent/20 transition"
          >
            Download All
          </button>
          <button
            onClick={() => dismissResult(result.playlistId)}
            className="px-3 py-1 text-xs text-text-muted hover:text-text-secondary transition"
          >
            Dismiss
          </button>
        </div>
      ))}

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <div className="relative mb-3">
            <div className="absolute inset-0 rounded-full blur-xl opacity-30" style={{ background: 'var(--accent)' }} />
            <MusicalNoteIcon className="relative w-12 h-12 opacity-30" style={{ animation: 'textPulse 2s ease-in-out infinite' }} />
          </div>
          <p className="text-lg font-display">Your library is empty</p>
          <p className="text-sm mt-1">Download some playlists to get started</p>
        </div>
      ) : (
        <TrackList tracks={tracks} />
      )}

      {/* Delete All Confirmation Modal */}
      <Modal open={showDeleteAllConfirm} onClose={() => setShowDeleteAllConfirm(false)} className="p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">
          {playlistFilter !== 'all' ? `Delete ${tracks.length} Playlist Tracks?` : 'Delete Entire Library?'}
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          {playlistFilter !== 'all'
            ? `This will permanently delete all ${tracks.length} tracks from this playlist and their audio files from disk. This action cannot be undone.`
            : `This will permanently delete all ${tracks.length} tracks and their audio files from disk. This action cannot be undone.`}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteAllConfirm(false)}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteAll}
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            {playlistFilter !== 'all' ? 'Delete Playlist Tracks' : 'Delete Everything'}
          </button>
        </div>
      </Modal>

      {/* Playlist Info Modal */}
      {showPlaylistInfo && playlistFilter !== 'all' && (
        <PlaylistInfoModal
          playlistId={playlistFilter}
          onClose={() => setShowPlaylistInfo(false)}
        />
      )}

      {/* Delete Selected Confirmation Modal */}
      <Modal open={showDeleteSelectedConfirm} onClose={() => setShowDeleteSelectedConfirm(false)} className="p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">Delete {selectedTrackIds.size} tracks?</h3>
        <p className="text-sm text-text-secondary mb-6">
          This will permanently delete the selected tracks and their audio files from disk. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteSelectedConfirm(false)}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-accent/50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteSelected}
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            Delete Selected
          </button>
        </div>
      </Modal>
    </div>
  )
}
