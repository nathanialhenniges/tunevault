import { memo } from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { AlbumArt } from '../ui/AlbumArt'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'

export const NowPlaying = memo(function NowPlaying(): JSX.Element {
  const track = usePlayerStore((s) => s.currentTrack)

  if (!track) {
    return (
      <div className="flex items-center gap-3 w-52">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--glass-float-bg)', backdropFilter: 'blur(8px)' }}>
          <MusicalNoteIcon className="w-5 h-5 text-text-muted" />
        </div>
        <div className="text-sm text-text-muted">Nothing playing</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 w-52 min-w-0">
      <div className="relative shrink-0">
        <div
          className="absolute inset-0 rounded-lg blur-md opacity-40"
          style={{ background: 'var(--accent)' }}
        />
        <AlbumArt
          src={track.thumbnailUrl}
          alt={track.title}
          className="relative w-12 h-12"
          radius="0.5rem"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)' }}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{track.title}</p>
        <p className="text-xs text-text-secondary truncate">{track.artist}</p>
        <p className="text-[10px] text-text-muted truncate mt-0.5">{track.playlistTitle}</p>
      </div>
    </div>
  )
})
