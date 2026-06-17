import { useState, useEffect, useRef } from 'react'
import { useLibraryStore } from '../../store/libraryStore'

export function SearchBar(): JSX.Element {
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery)
  const [inputValue, setInputValue] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (value: string): void => {
    setInputValue(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, 300)
  }

  return (
    <input
      type="text"
      value={inputValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Search tracks..."
      aria-label="Search tracks"
      className="w-full max-w-sm border border-[var(--glass-border-edge)] rounded-lg px-4 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
      style={{ background: 'var(--glass-input-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    />
  )
}
