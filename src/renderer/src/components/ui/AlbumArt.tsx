import { useState, useEffect } from 'react'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'

interface AlbumArtProps {
  src?: string
  alt?: string
  /** Tailwind size classes, e.g. "w-9 h-9". */
  className?: string
  /** Corner radius. Defaults to a small rounded; pass e.g. 'var(--radius-card)'. */
  radius?: string
  style?: React.CSSProperties
}

/**
 * Album art with a graceful gradient fallback. When the image is missing or
 * fails to load, an accent-tinted gradient + note shows instead of an empty
 * box — no more "broken square" placeholders.
 */
export function AlbumArt({ src, alt = '', className = 'w-9 h-9', radius, style }: AlbumArtProps): JSX.Element {
  const [failed, setFailed] = useState(false)
  // Reset the failure flag when the art source changes — instances persist
  // across track changes (e.g. the single NowPlaying art), so a stale `failed`
  // would otherwise show the fallback for every later track once one 404s.
  useEffect(() => setFailed(false), [src])
  const showImg = src && !failed
  const borderRadius = radius ?? '6px'

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{
        borderRadius,
        background:
          'linear-gradient(140deg, rgba(var(--accent-rgb), 0.30), rgba(var(--accent-rgb), 0.08) 55%, var(--bg-inset))',
        ...style
      }}
    >
      {!showImg && (
        /* text-secondary reads on the gradient in BOTH themes (a fixed
           --text-inverted was near-black-on-near-black in dark mode). */
        <span className="absolute inset-0 flex items-center justify-center text-text-secondary">
          <MusicalNoteIcon className="w-1/2 h-1/2 opacity-80" />
        </span>
      )}
      {showImg && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
