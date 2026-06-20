import { app, net, nativeImage } from 'electron'
import { createHash } from 'crypto'
import { join } from 'path'
import { promises as fsp, existsSync, mkdirSync, rmSync } from 'fs'

export interface ArtColor {
  r: number
  g: number
  b: number
}

const cacheDir = (): string => join(app.getPath('userData'), 'cache')
const artDir = (): string => join(cacheDir(), 'art')
const ensureDirs = (): void => {
  mkdirSync(artDir(), { recursive: true })
}
const keyFor = (url: string): string => createHash('sha1').update(url).digest('hex')
const isRemote = (url: string): boolean => /^https?:\/\//.test(url)

// Album art only ever comes from these CDNs (YouTube/Google, SoundCloud, Apple,
// MusicBrainz cover art). Restricting fetches to them stops the renderer from
// using tvcache:// to make the main process fetch arbitrary internal URLs (SSRF).
const ART_HOST = /(?:^|\.)(?:ytimg\.com|ggpht\.com|googleusercontent\.com|sndcdn\.com|mzstatic\.com|scdn\.co|coverartarchive\.org|archive\.org)$/
const isAllowedArtHost = (url: string): boolean => {
  try {
    return ART_HOST.test(new URL(url).hostname.toLowerCase())
  } catch {
    return false
  }
}
const MAX_ART_BYTES = 10 * 1024 * 1024 // 10 MB — art is never legitimately bigger

// In-memory palette cache. Re-derived cheaply from the on-disk art cache after a
// restart, so it doesn't need to persist.
const paletteCache = new Map<string, ArtColor | null>()

export const CacheService = {
  /**
   * Local cached file for a remote art URL, fetching + storing it on a miss.
   * Returns null when the URL isn't remote, the fetch fails (e.g. offline), or
   * the body is empty — callers fall back gracefully.
   */
  async getArtFile(url: string): Promise<string | null> {
    if (!isRemote(url) || !isAllowedArtHost(url)) return null
    ensureDirs()
    const file = join(artDir(), keyFor(url))
    if (existsSync(file)) return file
    try {
      const res = await net.fetch(url)
      if (!res.ok) return null
      const type = res.headers.get('content-type') || ''
      if (type && !type.startsWith('image/')) return null
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length === 0 || buf.length > MAX_ART_BYTES) return null
      await fsp.writeFile(file, buf)
      return file
    } catch {
      return null
    }
  },

  /**
   * Dominant, saturation-weighted color of a track's art. Extraction runs in the
   * main process via the built-in nativeImage decoder, so there's no canvas/CORS
   * problem with cross-origin thumbnails. Cached per URL.
   */
  async extractColor(url: string): Promise<ArtColor | null> {
    if (!url) return null
    if (paletteCache.has(url)) return paletteCache.get(url) ?? null

    const file = await this.getArtFile(url)
    let buf: Buffer | null = null
    if (file) {
      try {
        buf = await fsp.readFile(file)
      } catch {
        buf = null
      }
    }
    if (!buf) {
      paletteCache.set(url, null)
      return null
    }

    const img = nativeImage.createFromBuffer(buf)
    if (img.isEmpty()) {
      paletteCache.set(url, null)
      return null
    }
    const small = img.resize({ width: 24, height: 24, quality: 'good' })
    const bmp = small.toBitmap() // BGRA
    const { width, height } = small.getSize()

    let wr = 0,
      wg = 0,
      wb = 0,
      wsum = 0
    for (let i = 0; i < width * height; i++) {
      const b = bmp[i * 4]
      const g = bmp[i * 4 + 1]
      const r = bmp[i * 4 + 2]
      const a = bmp[i * 4 + 3]
      if (a < 200) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      const lum = max / 255
      // Favor vibrant mid-tones; discount near-black / near-white so the tint
      // tracks the art's character rather than its background.
      const w = (sat * 0.85 + 0.15) * (lum > 0.12 && lum < 0.96 ? 1 : 0.2)
      wr += r * w
      wg += g * w
      wb += b * w
      wsum += w
    }
    if (wsum === 0) {
      paletteCache.set(url, null)
      return null
    }
    const color: ArtColor = {
      r: Math.round(wr / wsum),
      g: Math.round(wg / wsum),
      b: Math.round(wb / wsum)
    }
    paletteCache.set(url, color)
    return color
  },

  async stats(): Promise<{ bytes: number; files: number }> {
    ensureDirs()
    let bytes = 0
    let files = 0
    try {
      const entries = await fsp.readdir(artDir())
      for (const e of entries) {
        try {
          const st = await fsp.stat(join(artDir(), e))
          bytes += st.size
          files++
        } catch {
          // skip unreadable entry
        }
      }
    } catch {
      // dir missing
    }
    return { bytes, files }
  },

  /** Wipe cached art + palettes. Library and settings are untouched. */
  clearCache(): void {
    paletteCache.clear()
    try {
      rmSync(cacheDir(), { recursive: true, force: true })
    } catch {
      // ignore
    }
    ensureDirs()
  },

  /** Full reset: cache + library.json + settings.json. Caller restarts the app. */
  clearAllData(): void {
    this.clearCache()
    const ud = app.getPath('userData')
    for (const f of ['library.json', 'settings.json']) {
      try {
        rmSync(join(ud, f), { force: true })
      } catch {
        // ignore
      }
    }
  }
}
