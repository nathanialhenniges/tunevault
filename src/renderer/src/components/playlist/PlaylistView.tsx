import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { PlaylistInput } from './PlaylistInput'
import { TrackRow } from './TrackRow'
import { usePlaylistStore } from '../../store/playlistStore'
import { useDownloadStore } from '../../store/downloadStore'
import { useDownload } from '../../hooks/useDownload'
import { useWolfMode } from '../../hooks/useWolfMode'
import { Checkbox } from '../ui/Checkbox'
import { PlaylistLoader } from '../ui/PlaylistLoader'
import { ContextMenu } from '../ui/ContextMenu'
import { TrackDetailModal } from '../ui/TrackDetailModal'
import { PageHeader } from '../ui/PageHeader'
import { AlbumArt } from '../ui/AlbumArt'
import { useSettingsStore } from '../../store/settingsStore'
import type { Track, TrackDensity } from '../../../../shared/models'
import { useVirtualizer } from '@tanstack/react-virtual'
import wolfIcon from '../../assets/wolf-icon.png'
import {
  ArrowPathIcon,
  ClockIcon,
  MusicalNoteIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function VirtualizedTrackList({
  trackListRef,
  tracks,
  selected,
  downloads,
  density,
  toggleOne,
  handleContextMenu
}: {
  trackListRef: React.RefObject<HTMLDivElement | null>
  tracks: Track[]
  selected: Set<string>
  downloads: Map<string, import('../../../../shared/models').DownloadProgress>
  density: TrackDensity
  toggleOne: (id: string) => void
  handleContextMenu: (e: React.MouseEvent, track: Track) => void
}): JSX.Element {
  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => trackListRef.current,
    estimateSize: () => (density === 'compact' ? 40 : 52),
    overscan: 5
  })

  // Re-measure when the density setting changes.
  useEffect(() => {
    rowVirtualizer.measure()
  }, [density, rowVirtualizer])

  return (
    <div
      ref={trackListRef}
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
              <TrackRow
                track={track}
                index={virtualRow.index}
                tracks={tracks}
                selected={selected.has(track.id)}
                density={density}
                onToggleSelect={() => toggleOne(track.id)}
                downloadProgress={downloads.get(track.id)}
                onContextMenu={handleContextMenu}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PlaylistView(): JSX.Element {
  const { currentPlaylist, loading, loadedFromCache, refreshPlaylist } = usePlaylistStore()
  const { startDownload, isDownloading } = useDownload()
  const density = useSettingsStore((s) => s.settings.trackDensity)
  const downloads = useDownloadStore((s) => s.downloads)
  const clearDownloads = useDownloadStore((s) => s.clear)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const wolfMode = useWolfMode()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null)
  const [detailTrack, setDetailTrack] = useState<Track | null>(null)
  const trackListRef = useRef<HTMLDivElement>(null)

  // Reset state and scroll when a new playlist is fetched
  useEffect(() => {
    setSelected(new Set())
    clearDownloads()
    trackListRef.current?.scrollTo(0, 0)
  }, [currentPlaylist])

  const allIds = useMemo(
    () => new Set(currentPlaylist?.tracks.map((t) => t.id) ?? []),
    [currentPlaylist]
  )

  const allSelected = currentPlaylist ? selected.size === currentPlaylist.tracks.length : false

  const totalDuration = useMemo(
    () => currentPlaylist?.tracks.reduce((sum, t) => sum + t.duration, 0) ?? 0,
    [currentPlaylist]
  )

  // Download completion summary
  const downloadSummary = useMemo(() => {
    if (downloads.size === 0) return null
    const all = Array.from(downloads.values())
    const stillActive = all.some(
      (d) => d.status !== 'done' && d.status !== 'skipped' && d.status !== 'error'
    )
    if (stillActive) return null

    const done = all.filter((d) => d.status === 'done').length
    const skipped = all.filter((d) => d.status === 'skipped').length
    const errors = all.filter((d) => d.status === 'error').length
    return { done, skipped, errors, total: all.length }
  }, [downloads])

  // Active download stats
  const downloadStats = useMemo(() => {
    if (downloads.size === 0) return null
    const all = Array.from(downloads.values())
    const active = all.filter(
      (d) => d.status === 'downloading' || d.status === 'converting' || d.status === 'tagging' || d.status === 'rate-limited'
    ).length
    const done = all.filter((d) => d.status === 'done').length
    const total = all.length
    if (active === 0 && done === 0) return null
    return { active, done, total }
  }, [downloads])

  const toggleOne = useCallback((trackId: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })
  }, [])

  const toggleAll = (): void => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  const handleDownload = (): void => {
    if (selected.size > 0) {
      startDownload(selected)
    } else {
      // "Download All" — select all tracks in the UI to reflect the action
      if (currentPlaylist) {
        setSelected(new Set(allIds))
      }
      startDownload()
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, track: Track) => {
    setContextMenu({ x: e.clientX, y: e.clientY, track })
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      {!currentPlaylist && !loading ? (
        /* ── Empty state — native start screen: app glyph anchor + one serif line ── */
        <div className="relative flex-1 flex flex-col items-center justify-center text-center px-4 -mt-4">
          <div className="relative w-full max-w-md">
            <img
              src={wolfIcon}
              alt=""
              aria-hidden
              className="w-14 h-14 mx-auto mb-5 opacity-90 select-none"
              style={{ filter: 'drop-shadow(0 4px 14px rgba(var(--accent-rgb), 0.25))' }}
            />
            <h1
              className="text-balance font-semibold text-text-primary"
              style={{ fontSize: '1.9rem', letterSpacing: '-0.02em' }}
            >
              Add music to your vault
            </h1>
            <p className="mt-3 mb-7 text-sm text-text-secondary text-balance">
              Paste a YouTube or Apple Music link — every track is fetched, tagged
              with artwork, and filed into your library.
            </p>
            <PlaylistInput />
            <p className="mt-4 text-xs text-text-muted">
              Supports YouTube, Apple Music, and SoundCloud links.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <PageHeader title="Fetch a playlist" />
          <div className="mt-4">
            <PlaylistInput />
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 300px)' }}>
          <PlaylistLoader wolfMode={wolfMode} />
        </div>
      )}

      {downloadSummary && !loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-glass-hover border border-[var(--glass-border-edge)] text-sm">
          <span className="text-accent font-medium">Download complete</span>
          <span className="text-text-secondary">
            {downloadSummary.done}/{downloadSummary.total} downloaded
            {downloadSummary.skipped > 0 && ` · ${downloadSummary.skipped} skipped`}
            {downloadSummary.errors > 0 && ` · ${downloadSummary.errors} failed`}
          </span>
          {downloadSummary.errors > 0 && (
            <button
              onClick={() => {
                const errorIds = new Set<string>()
                downloads.forEach((d, id) => {
                  if (d.status === 'error') errorIds.add(id)
                })
                startDownload(errorIds, true)
              }}
              className="ml-auto px-3 py-1.5 bg-accent hover:bg-accent-hover text-text-inverted rounded-lg text-xs font-medium transition"
            >
              Retry Failed
            </button>
          )}
        </div>
      )}

      {currentPlaylist && (
        <div className="flex flex-col flex-1 min-h-0 space-y-4">
          {/* Playlist header — sticky */}
          <div className="sticky top-0 z-10 pb-2" style={{ background: 'var(--glass-sidebar-bg)', backdropFilter: 'blur(var(--glass-blur-chrome))', WebkitBackdropFilter: 'blur(var(--glass-blur-chrome))' }}>
            <div className="flex items-center gap-4">
              <AlbumArt
                src={currentPlaylist.thumbnailUrl}
                className="w-16 h-16"
                radius="var(--radius-card)"
                style={{ boxShadow: 'var(--shadow-glass-lg)' }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">{currentPlaylist.title}</h2>
                  {loadedFromCache && (
                    <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-glass-hover border border-[var(--glass-border-edge)] rounded shrink-0">cached</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary">{currentPlaylist.channelTitle}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <MusicalNoteIcon className="w-3 h-3" />
                    {currentPlaylist.tracks.length} tracks
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {formatTotalDuration(totalDuration)}
                  </span>
                  {downloadStats && isDownloading && (
                    <span className="text-accent">
                      Downloading {downloadStats.done}/{downloadStats.total}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={refreshPlaylist}
                  disabled={loading}
                  className="p-2.5 text-text-secondary hover:text-accent border border-border-default rounded-lg hover:border-accent/40 hover:bg-accent/5 transition-all disabled:opacity-50"
                  title="Refresh playlist from YouTube"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-text-inverted disabled:bg-bg-inset disabled:text-text-muted rounded-lg text-sm font-medium transition"
                >
                  {isDownloading
                    ? 'Downloading...'
                    : selected.size > 0
                      ? `Download ${selected.size}`
                      : 'Download All'}
                </button>
              </div>
            </div>

            {/* Selection toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 mt-3 border-b border-border-subtle">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-text-muted select-none hover:text-text-secondary transition"
              >
                <Checkbox checked={allSelected} onChange={toggleAll} />
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              {selected.size > 0 && (
                <>
                  <span className="text-xs text-accent font-medium">{selected.size} selected</span>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-text-muted hover:text-text-secondary transition"
                  >
                    Clear
                  </button>
                </>
              )}
              {/* Column labels */}
              <div className="ml-auto flex items-center gap-4 text-[10px] text-text-muted uppercase tracking-wider">
                <span className="w-12 text-right">Time</span>
                <span className="w-20 text-right">Status</span>
              </div>
            </div>
          </div>

          <VirtualizedTrackList
            trackListRef={trackListRef}
            tracks={currentPlaylist.tracks}
            selected={selected}
            downloads={downloads}
            density={density}
            toggleOne={toggleOne}
            handleContextMenu={handleContextMenu}
          />
        </div>
      )}

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
            ...(downloads.get(contextMenu.track.id)?.status === 'error' ? [{
              label: 'Retry Download',
              icon: <ArrowPathIcon className="w-4 h-4" />,
              onClick: () => startDownload(new Set([contextMenu.track.id]), true)
            }] : [])
          ]}
        />
      )}

      {detailTrack && (
        <TrackDetailModal track={detailTrack} onClose={() => setDetailTrack(null)} />
      )}
    </div>
  )
}
