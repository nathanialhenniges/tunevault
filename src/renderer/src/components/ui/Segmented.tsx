import { useRef } from 'react'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: React.ReactNode
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** 'sm' = square chips (number pickers); 'md' = text segments (default). */
  size?: 'sm' | 'md'
  ariaLabel: string
}

/**
 * Native segmented control: a recessed track with a single raised chip marking
 * the selection — the macOS/Fluent pattern, not web accent-fill pills. Behaves
 * as a radiogroup with arrow-key navigation for keyboard/AT users.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel
}: SegmentedProps<T>): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  const move = (dir: 1 | -1): void => {
    const idx = options.findIndex((o) => o.value === value)
    const nextIdx = (idx + dir + options.length) % options.length
    onChange(options[nextIdx].value)
    // Move focus to the newly selected segment (roving tabindex).
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[nextIdx]?.focus()
  }

  const handleKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    }
  }

  const seg = size === 'sm' ? 'w-9 h-8 justify-center' : 'px-3.5 h-8'

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKey}
      className="inline-flex items-center p-0.5 rounded-[9px] bg-bg-inset border border-[var(--glass-border-edge)]"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 ${seg} rounded-[7px] text-[13px] font-medium transition-colors ${
              active
                ? 'bg-bg-raised text-text-primary shadow-[var(--shadow-glass-sm)]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
