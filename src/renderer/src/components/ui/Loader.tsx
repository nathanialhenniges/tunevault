interface LoaderProps {
  /** Disc diameter in px. Default is sized for a centered page loader. */
  size?: number
  /** Optional pulsing caption below the disc. */
  label?: string
  className?: string
}

/**
 * Spinning-vinyl loader — the app's single universal loading animation. A black
 * record with grooves, an accent center label, and a rotating sheen so the spin
 * reads even though the grooves are symmetric. Scales cleanly (SVG) and is meant
 * to sit big and centered.
 */
export function Loader({ size = 72, label, className = '' }: LoaderProps): JSX.Element {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`} role="status" aria-label={label ?? 'Loading'}>
      <svg
        viewBox="0 0 100 100"
        className="animate-spin"
        style={{ width: size, height: size, animationDuration: '1.5s' }}
        aria-hidden
      >
        {/* disc */}
        <circle cx="50" cy="50" r="49" fill="#0b0b0e" />
        <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
        {/* rotating sheen wedge — makes the spin visible */}
        <path d="M50 50 L50 2 A48 48 0 0 1 84 16 Z" fill="rgba(255,255,255,0.06)" />
        {/* grooves */}
        <g fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75">
          <circle cx="50" cy="50" r="44" />
          <circle cx="50" cy="50" r="39" />
          <circle cx="50" cy="50" r="34" />
          <circle cx="50" cy="50" r="29" />
        </g>
        {/* center label + spindle hole */}
        <circle cx="50" cy="50" r="17" fill="var(--accent)" />
        <circle cx="50" cy="50" r="17" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.75" />
        <circle cx="50" cy="50" r="2.4" fill="#0b0b0e" />
      </svg>
      {label && (
        <span className="text-sm text-text-secondary" style={{ animation: 'textPulse 2s ease-in-out infinite' }}>
          {label}
        </span>
      )}
    </div>
  )
}
