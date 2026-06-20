interface PageHeaderProps {
  /** The view title — system sans (native), not the serif. */
  title: React.ReactNode
  /** Supporting line under the title. */
  subtitle?: React.ReactNode
  /** Right-aligned actions (buttons, search, etc.). */
  actions?: React.ReactNode
}

/**
 * Compact, native page header used across every view. Toolbar-style: a tight
 * sans title (the serif is reserved for the sidebar wordmark only) so the
 * content below owns the vertical space.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold tracking-tight leading-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13px] text-text-secondary max-w-xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 pb-0.5">{actions}</div>}
    </div>
  )
}
