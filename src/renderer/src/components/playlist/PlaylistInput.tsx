import { useState, useRef, useEffect } from 'react'
import { usePlaylistStore } from '../../store/playlistStore'

export function PlaylistInput(): JSX.Element {
  const [url, setUrl] = useState('')
  const [showRecent, setShowRecent] = useState(false)
  const { fetchPlaylist, loading, error, clearError, clearPlaylist, recentPlaylists, pendingUrl, setPendingUrl } = usePlaylistStore()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync URL from drag-and-drop
  useEffect(() => {
    if (pendingUrl) {
      setUrl(pendingUrl)
      setPendingUrl(null)
    }
  }, [pendingUrl, setPendingUrl])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!url.trim()) return
    setShowRecent(false)
    fetchPlaylist(url.trim())
  }

  const handleChange = (value: string): void => {
    setUrl(value)
    if (error) clearError()
    // Clear playlist when input is emptied
    if (!value.trim()) {
      clearPlaylist()
    }
  }

  const handleSelectRecent = (recentUrl: string): void => {
    setUrl(recentUrl)
    setShowRecent(false)
    fetchPlaylist(recentUrl)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRecent(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1" ref={dropdownRef}>
          <input
            ref={inputRef}
            type="text"
            value={url}
            disabled={loading}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => {
              if (recentPlaylists.length > 0 && !loading) setShowRecent(true)
            }}
            placeholder="Paste a YouTube or Apple Music playlist URL..."
            aria-label="YouTube or Apple Music playlist URL"
            className="w-full border border-[var(--glass-border-edge)] rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
            style={{ background: 'var(--glass-sidebar-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          />

          {showRecent && !loading && recentPlaylists.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 glass-float glass-border-float z-50 overflow-hidden glass-reveal" style={{ borderRadius: 'var(--radius-card)' }}>
              <div className="px-3 py-2 text-xs text-text-muted uppercase tracking-wider border-b border-[var(--glass-border-edge)]">
                Recent Playlists
              </div>
              {recentPlaylists.map((recent) => (
                <button
                  key={recent.url}
                  type="button"
                  onClick={() => handleSelectRecent(recent.url)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-glass-hover transition truncate"
                >
                  <span className="text-text-primary">{recent.title}</span>
                  <span className="block text-xs text-text-muted truncate mt-0.5">{recent.url}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-text-inverted disabled:bg-bg-inset disabled:text-text-muted rounded-lg text-sm font-medium transition"
        >
          {loading ? 'Fetching...' : 'Fetch Playlist'}
        </button>
      </form>

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
