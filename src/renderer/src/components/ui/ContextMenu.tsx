import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ContextMenuItem {
  label: string
  icon?: JSX.Element
  onClick: () => void
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Roving focus across the menu items for keyboard/AT users.
      const btns = menuRef.current ? Array.from(menuRef.current.querySelectorAll('button')) : []
      if (!btns.length) return
      const cur = btns.indexOf(document.activeElement as HTMLButtonElement)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        btns[(cur + 1 + btns.length) % btns.length].focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        btns[(cur - 1 + btns.length) % btns.length].focus()
      } else if (e.key === 'Home') {
        e.preventDefault()
        btns[0].focus()
      } else if (e.key === 'End') {
        e.preventDefault()
        btns[btns.length - 1].focus()
      }
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    // Move focus into the menu so arrow keys / Enter work immediately.
    menuRef.current?.querySelector('button')?.focus()
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Clamp menu to viewport after mount
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    if (rect.right > window.innerWidth - pad) {
      el.style.left = `${window.innerWidth - rect.width - pad}px`
    }
    if (rect.bottom > window.innerHeight - pad) {
      el.style.top = `${window.innerHeight - rect.height - pad}px`
    }
  }, [x, y])

  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 200,
    borderRadius: 'var(--radius-card)'
  }

  // Portal to <body> so the fixed left/top is measured from the viewport. The
  // route wrapper holds a transform during/after its enter animation, which
  // would otherwise become the containing block and offset the menu.
  return createPortal(
    <div ref={menuRef} role="menu" aria-orientation="vertical" style={style} className="min-w-[180px] py-1.5 px-1 glass-float glass-border-float glass-reveal">
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          onClick={() => { item.onClick(); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition rounded-[var(--radius-item)] ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-text-secondary hover:bg-glass-hover hover:text-text-primary'
          }`}
        >
          {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
