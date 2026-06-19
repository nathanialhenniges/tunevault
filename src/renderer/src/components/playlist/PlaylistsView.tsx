import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../../store/libraryStore'
import { PageHeader } from '../ui/PageHeader'
import { AlbumArt } from '../ui/AlbumArt'
import { Loader } from '../ui/Loader'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'

/**
 * Browse screen for the playlists already in your library. Cards open the
 * Library filtered to that playlist (same target as the sidebar shortcut).
 * Fetching new playlists lives on Home; this is purely "what do I already have".
 */
export function PlaylistsView(): JSX.Element {
  const navigate = useNavigate()
  const loaded = useLibraryStore((s) => s.loaded)
  const load = useLibraryStore((s) => s.load)
  const playlists = useLibraryStore((s) => s.library.playlists)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  const openPlaylist = (id: string): void => {
    navigate('/library', { state: { playlistFilter: id } })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <PageHeader
        title="Playlists"
        subtitle={`${playlists.length} playlist${playlists.length === 1 ? '' : 's'} in your library`}
      />

      {!loaded ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader size={72} />
        </div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center flex-1 py-20">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-25" style={{ background: 'var(--accent)' }} />
            <MusicalNoteIcon className="relative w-12 h-12 text-accent opacity-80" />
          </div>
          <p className="text-base font-medium text-text-primary">No playlists yet</p>
          <p className="text-sm text-text-secondary mt-1 max-w-xs">
            Head to Home to fetch a YouTube or Apple Music playlist.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-accent mt-5 px-5 py-2.5 rounded-lg text-sm font-medium"
          >
            Go to Home
          </button>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] pb-4">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => openPlaylist(pl.id)}
              className="group text-left flex flex-col gap-2.5 p-3 rounded-[var(--radius-card)] hover:bg-glass-hover transition-colors"
            >
              <AlbumArt
                src={pl.thumbnailUrl}
                className="w-full aspect-square"
                radius="var(--radius-card)"
                style={{ boxShadow: 'var(--shadow-glass-md)' }}
              />
              <div className="min-w-0 px-0.5">
                <p className="text-sm font-medium text-text-primary truncate">{pl.title}</p>
                <p className="text-xs text-text-muted truncate mt-0.5">
                  {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
