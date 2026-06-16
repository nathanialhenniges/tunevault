interface CheckboxProps {
  checked: boolean
  onChange: () => void
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

export function Checkbox({ checked, onChange, onClick, className = '' }: CheckboxProps): JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        if (onClick) {
          onClick(e)
        } else {
          onChange()
        }
      }}
      className={`tv-checkbox group relative shrink-0 w-[18px] h-[18px] rounded-[5px] border transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base ${
        checked
          ? 'bg-accent border-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.35)]'
          : 'border-border-default bg-bg-inset hover:border-text-muted'
      } ${className}`}
    >
      {/* Checkmark SVG */}
      <svg
        viewBox="0 0 12 12"
        fill="none"
        className={`absolute inset-0 m-auto w-[11px] h-[11px] transition-all duration-200 ease-out ${
          checked
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75'
        }`}
      >
        <path
          d="M2.5 6.5L5 9L9.5 3.5"
          stroke="var(--text-inverted)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Subtle hover pulse ring for unchecked state */}
      {!checked && (
        <span className="absolute -inset-[3px] rounded-[7px] border border-transparent group-hover:border-accent/20 transition-colors duration-200" />
      )}
    </button>
  )
}
