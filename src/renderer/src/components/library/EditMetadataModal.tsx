import { useState } from 'react'
import type { Track } from '../../../../shared/models'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { AlbumArt } from '../ui/AlbumArt'
import { ITUNES_GENRES } from '../../lib/genres'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface EditMetadataModalProps {
  tracks: Track[]
  onClose: () => void
  onSave: (patch: { title?: string; artist?: string; genre?: string }) => Promise<void>
}

type Field = 'title' | 'artist' | 'genre'

/** Common value across the selection for a field, or '' if they differ. */
function commonValue(tracks: Track[], key: Field): string {
  const vals = new Set(tracks.map((t) => (t[key] ?? '') as string))
  return vals.size === 1 ? ([...vals][0] ?? '') : ''
}
function varies(tracks: Track[], key: Field): boolean {
  return new Set(tracks.map((t) => (t[key] ?? '') as string)).size > 1
}

export function EditMetadataModal({ tracks, onClose, onSave }: EditMetadataModalProps): JSX.Element {
  const multi = tracks.length > 1

  // Title is per-track, so only offer it for a single selection.
  const initTitle = multi ? '' : tracks[0]?.title ?? ''
  const initArtist = commonValue(tracks, 'artist')
  const initGenre = commonValue(tracks, 'genre')

  const [title, setTitle] = useState(initTitle)
  const [artist, setArtist] = useState(initArtist)
  const [genre, setGenre] = useState(initGenre)
  const [saving, setSaving] = useState(false)

  const handleSave = async (): Promise<void> => {
    const patch: { title?: string; artist?: string; genre?: string } = {}
    if (!multi && title.trim() !== initTitle) patch.title = title.trim()
    if (artist !== initArtist) patch.artist = artist.trim()
    if (genre !== initGenre) patch.genre = genre.trim()
    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await onSave(patch)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full border border-[var(--glass-border-edge)] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted bg-glass-hover focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition'

  // Up to 4 thumbnails for the multi-select header (a quick "these tracks" cue).
  const covers = tracks.slice(0, 4)

  return (
    <Drawer open onClose={() => !saving && onClose()}>
      {/* Header */}
      <div className="flex items-start gap-4 p-6 pb-4 border-b border-[var(--glass-border-edge)]">
        {multi ? (
          <div className="flex -space-x-3 shrink-0">
            {covers.map((t, i) => (
              <AlbumArt
                key={t.id}
                src={t.thumbnailUrl}
                className="w-12 h-12 ring-2 ring-[var(--bg-raised)]"
                radius="var(--radius-card)"
                style={{ zIndex: covers.length - i }}
              />
            ))}
          </div>
        ) : (
          <AlbumArt src={tracks[0]?.thumbnailUrl} className="w-16 h-16" radius="var(--radius-card)" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">Edit metadata</h2>
          <p className="text-sm text-text-secondary">
            {multi ? `${tracks.length} tracks · blank fields stay unchanged` : 'Updates the library and re-tags the file'}
          </p>
        </div>
        <button
          onClick={() => !saving && onClose()}
          className="p-1.5 text-text-muted hover:text-text-primary transition rounded-lg hover:bg-glass-hover shrink-0"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3.5">
          {!multi && (
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">Title</span>
              <input className={`mt-1 ${inputCls}`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Artist</span>
            <input
              className={`mt-1 ${inputCls}`}
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder={varies(tracks, 'artist') ? 'Multiple values' : ''}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Genre</span>
            <input
              className={`mt-1 ${inputCls}`}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              list="itunes-genres-edit"
              placeholder={varies(tracks, 'genre') ? 'Multiple values' : 'Choose or type a genre'}
            />
            <datalist id="itunes-genres-edit">
              {ITUNES_GENRES.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 pt-4 border-t border-[var(--glass-border-edge)] flex gap-3 justify-end">
        <Button variant="ghost" disabled={saving} onClick={() => onClose()}>
          Cancel
        </Button>
        <Button variant="primary" loading={saving} loadingLabel="Saving…" onClick={handleSave}>
          Save{multi ? ` ${tracks.length}` : ''}
        </Button>
      </div>
    </Drawer>
  )
}
