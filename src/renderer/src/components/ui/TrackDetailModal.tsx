import type { Track } from '../../../../shared/models'
import { formatDuration } from '../../../../shared/utils'
import { Modal } from './Modal'
import { AlbumArt } from './AlbumArt'
import {
  XMarkIcon,
  ClockIcon,
  MusicalNoteIcon,
  CalendarIcon,
  SignalIcon,
  LinkIcon
} from '@heroicons/react/24/outline'

interface TrackDetailModalProps {
  track: Track
  onClose: () => void
}

export function TrackDetailModal({ track, onClose }: TrackDetailModalProps): JSX.Element {
  return (
    <Modal open={true} onClose={onClose} className="max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 pb-4">
        <AlbumArt src={track.thumbnailUrl} alt={track.title} className="w-16 h-16" radius="0.5rem" />
        <div className="flex-1 min-w-0">
          <h2 id="track-detail-title" className="text-lg font-semibold truncate">{track.title}</h2>
          <p className="text-sm text-text-secondary truncate">{track.artist}</p>
          <p className="text-xs text-text-muted mt-1">{track.playlistTitle}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-text-muted hover:text-text-primary transition rounded-lg hover:bg-glass-hover shrink-0"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Metadata grid */}
      <div className="px-6 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm">
          <ClockIcon className="w-4 h-4 text-text-muted shrink-0" />
          <span className="text-text-secondary">Duration</span>
          <span className="ml-auto text-text-primary">{formatDuration(track.duration)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MusicalNoteIcon className="w-4 h-4 text-text-muted shrink-0" />
          <span className="text-text-secondary">Position</span>
          <span className="ml-auto text-text-primary">#{track.position}</span>
        </div>
        {track.releaseDate && (
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-text-secondary">Released</span>
            <span className="ml-auto text-text-primary">{track.releaseDate}</span>
          </div>
        )}
        {track.bitrate && (
          <div className="flex items-center gap-2 text-sm">
            <SignalIcon className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-text-secondary">Bitrate</span>
            <span className="ml-auto text-text-primary">{track.bitrate}kbps</span>
          </div>
        )}
        {track.format && (
          <div className="flex items-center gap-2 text-sm">
            <MusicalNoteIcon className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-text-secondary">Format</span>
            <span className="ml-auto text-text-primary uppercase">{track.format}</span>
          </div>
        )}
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

      {/* Description */}
      {track.description && (
        <div className="px-6 pt-4 pb-2 flex-1 min-h-0 flex flex-col">
          <h3 className="text-sm font-medium text-text-primary mb-2">Description</h3>
          <div className="flex-1 overflow-y-auto rounded-lg bg-glass-hover border border-[var(--glass-border-edge)] p-3">
            <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
              {track.description}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-6 pt-4">
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-glass-hover hover:bg-glass-active text-text-secondary rounded-lg text-sm transition"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
