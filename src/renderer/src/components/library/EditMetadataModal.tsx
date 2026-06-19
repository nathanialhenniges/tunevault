import { useState } from 'react'
import type { Track } from '../../../../shared/models'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ITUNES_GENRES } from '../../lib/genres'

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

  return (
    <Modal open onClose={() => !saving && onClose()} className="p-6 max-w-md mx-4">
      <h3 className="text-lg font-semibold mb-1">Edit metadata</h3>
      <p className="text-sm text-text-secondary mb-5">
        {multi
          ? `Editing ${tracks.length} tracks. Fields left blank stay unchanged.`
          : 'Updates the library and re-tags the audio file.'}
      </p>

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
            list="itunes-genres"
            placeholder={varies(tracks, 'genre') ? 'Multiple values' : 'Choose or type a genre'}
          />
          <datalist id="itunes-genres">
            {ITUNES_GENRES.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="ghost" disabled={saving} onClick={() => onClose()}>
          Cancel
        </Button>
        <Button variant="primary" loading={saving} loadingLabel="Saving…" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  )
}
