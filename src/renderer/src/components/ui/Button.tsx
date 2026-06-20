import type { ButtonHTMLAttributes, ComponentType } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Shows an inline spinner, locks the action, and keeps full opacity (reads as
   *  "working", not "disabled"). Only pass for ops expected to exceed ~400ms. */
  loading?: boolean
  /** Leading icon (replaced by the spinner while loading, so width is stable). */
  icon?: ComponentType<{ className?: string }>
  /** Optional label swap while loading, e.g. "Sync" → "Syncing…". */
  loadingLabel?: string
}

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2'
}
const ICON: Record<Size, string> = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4' }

const VARIANT: Record<Variant, string> = {
  primary: 'btn-accent',
  secondary: 'text-text-secondary border border-border-default hover:text-accent hover:border-accent/40 hover:bg-accent/5',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-glass-hover',
  danger: 'text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 focus-visible:ring-red-500/60'
}

const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap select-none transition-all btn-press ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

function ButtonSpinner({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={`animate-spin shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-90" />
    </svg>
  )
}

/**
 * Shared button. Loading state shows an inline spinner without going through the
 * native `disabled` path — so it keeps focus + full styling and reads as busy,
 * not invalid. Clicks are swallowed while loading/disabled to block double-fire.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  loadingLabel,
  children,
  className = '',
  onClick,
  ...rest
}: ButtonProps): JSX.Element {
  const inert = loading || disabled
  return (
    <button
      {...rest}
      // Native disabled only for the real disabled case (gets opacity-50). While
      // loading we stay focusable + full-opacity and guard the click instead.
      disabled={disabled && !loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (inert) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={`${BASE} ${SIZE[size]} ${VARIANT[variant]} ${loading ? 'opacity-80' : ''} ${className}`}
    >
      {loading ? <ButtonSpinner className={ICON[size]} /> : Icon ? <Icon className={ICON[size]} /> : null}
      {children != null && <span>{loading && loadingLabel ? loadingLabel : children}</span>}
    </button>
  )
}
