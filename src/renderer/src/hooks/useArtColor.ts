import { useEffect, useState } from 'react'

// Module-scope cache so revisiting a track doesn't re-hit the main process.
const colorCache = new Map<string, string | null>()
// In-flight extractions keyed by url, so two components mounting the same
// uncached art don't each fire a duplicate IPC call.
const inflight = new Map<string, Promise<string | null>>()

/**
 * Dominant art color for a URL as an "r, g, b" string (for use in rgba(var(...))),
 * or null while unknown / unavailable. Extraction happens in the main process
 * (no CORS); results are cached here and there.
 */
export function useArtColor(url?: string): string | null {
  const [rgb, setRgb] = useState<string | null>(() => (url ? colorCache.get(url) ?? null : null))

  useEffect(() => {
    if (!url) {
      setRgb(null)
      return
    }
    if (colorCache.has(url)) {
      setRgb(colorCache.get(url) ?? null)
      return
    }
    let cancelled = false
    let shared = inflight.get(url)
    if (!shared) {
      // Optional-chain: a stale preload (mid dev-reload) shouldn't throw here.
      const pending = window.api.extractColor?.(url)
      if (!pending) {
        setRgb(null)
        return
      }
      shared = pending.then((c) => {
        const val = c ? `${c.r}, ${c.g}, ${c.b}` : null
        colorCache.set(url, val)
        inflight.delete(url)
        return val
      })
      inflight.set(url, shared)
    }
    shared
      .then((val) => {
        if (!cancelled) setRgb(val)
      })
      .catch(() => {
        inflight.delete(url)
        if (!cancelled) setRgb(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return rgb
}
