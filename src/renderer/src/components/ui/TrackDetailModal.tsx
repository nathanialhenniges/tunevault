import { useState } from 'react'
import type { Track } from '../../../../shared/models'
import { formatDuration } from '../../../../shared/utils'
import { Drawer } from './Drawer'
import { AlbumArt } from './AlbumArt'
import { Button } from './Button'
import { ITUNES_GENRES } from '../../lib/genres'
import {
  XMarkIcon,
  ClockIcon,
  MusicalNoteIcon,
  CalendarIcon,
  SignalIcon,
  LinkIcon,
  TagIcon
} from '@heroicons/react/24/outline'

interface TrackDetailModalProps {
  track: Track
  onClose: () => void
  /** When provided the inspector is editable (Title/Artist/Genre) + shows Save. */
  onSave?: (patch: { title?: string; artist?: string; genre?: string }) => Promise<void>
}

const FIELD =
  'w-full border border-[var(--glass-border-edge)] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted bg-glass-hover focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition'

export function TrackDetailModal({ track, onClose, onSave }: TrackDetailModalProps): JSX.Element {
  const editable = !!onSave
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist)
  const [genre, setGenre] = useState(track.genre ?? '')
  const [saving, setSaving] = useState(false)

  const dirty =
    title.trim() !== track.title ||
    artist.trim() !== track.artist ||
    genre.trim() !== (track.genre ?? '')

  const handleSave = async (): Promise<void> => {
    if (!onSave || !dirty) {
      onClose()
      return
    }
    const patch: { title?: string; artist?: string; genre?: string } = {}
    if (title.trim() !== track.title) patch.title = title.trim()
    if (artist.trim() !== track.artist) patch.artist = artist.trim()
    if (genre.trim() !== (track.genre ?? '')) patch.genre = genre.trim()
    setSaving(true)
    try {
      await onSave(patch)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open onClose={() => !saving && onClose()}>
      {/* Header */}
      <div className="flex items-start gap-4 p-6 pb-4 border-b border-[var(--glass-border-edge)]">
        <AlbumArt src={track.thumbnailUrl} alt={track.title} className="w-16 h-16" radius="var(--radius-card)" />
        <div className="flex-1 min-w-0">
          <h2 id="track-detail-title" className="text-lg font-semibold truncate">
            {editable ? title || 'Untitled' : track.title}
          </h2>
          <p className="text-sm text-text-secondary truncate">{editable ? artist : track.artist}</p>
          <p className="text-xs text-text-muted mt-1 truncate">{track.playlistTitle}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-text-muted hover:text-text-primary transition rounded-lg hover:bg-glass-hover shrink-0"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {editable && (
          <div className="space-y-3.5">
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">Title</span>
              <input className={`mt-1 ${FIELD}`} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">Artist</span>
              <input className={`mt-1 ${FIELD}`} value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">Genre</span>
              <input
                className={`mt-1 ${FIELD}`}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                list="itunes-genres"
                placeholder="Choose or type a genre"
              />
              <datalist id="itunes-genres">
                {ITUNES_GENRES.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
          </div>
        )}

        {/* Read-only facts */}
        <div className="grid grid-cols-2 gap-3">
          <Fact icon={ClockIcon} label="Duration" value={formatDuration(track.duration)} />
          <Fact icon={MusicalNoteIcon} label="Position" value={`#${track.position}`} />
          {track.releaseDate && <Fact icon={CalendarIcon} label="Released" value={track.releaseDate} />}
          {track.bitrate && <Fact icon={SignalIcon} label="Bitrate" value={`${track.bitrate}kbps`} />}
          {track.format && <Fact icon={MusicalNoteIcon} label="Format" value={track.format.toUpperCase()} />}
          {!editable && track.genre && <Fact icon={TagIcon} label="Genre" value={track.genre} />}
          {track.url && (
            <div className="flex items-center gap-2 text-sm col-span-2">
              <LinkIcon className="w-4 h-4 text-text-muted shrink-0" />
              <span className="text-text-secondary">URL</span>
              <a
                href={track.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-accent hover:text-accent-hover transition truncate max-w-[250px]"
              >
                {track.url}
              </a>
            </div>
          )}
        </div>

        {track.description && (
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">Description</h3>
            <div className="rounded-lg bg-glass-hover border border-[var(--glass-border-edge)] p-3">
              <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{track.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 pt-4 border-t border-[var(--glass-border-edge)] flex gap-3 justify-end">
        {editable ? (
          <>
            <Button variant="ghost" disabled={saving} onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" loading={saving} loadingLabel="Saving…" disabled={!dirty} onClick={handleSave}>
              Save
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </Drawer>
  )
}

function Fact({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-4 h-4 text-text-muted shrink-0" />
      <span className="text-text-secondary">{label}</span>
      <span className="ml-auto text-text-primary truncate">{value}</span>
    </div>
  )
}
