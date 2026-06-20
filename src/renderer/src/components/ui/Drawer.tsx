import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface DrawerProps {
  open: boolean
  onClose?: () => void
  className?: string
  children: ReactNode
}

/** Right-anchored slide-in panel (inspector). Same portal + focus-trap + backdrop
 *  semantics as Modal, but docked to the right edge. */
export function Drawer({ open, onClose, className, children }: DrawerProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, onClose)

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/40"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={`drawer-reveal h-full w-full max-w-md glass-modal border-l border-[var(--glass-border-edge)] flex flex-col ${className ?? ''}`}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
