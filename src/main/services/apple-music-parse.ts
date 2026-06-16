// Pure parser for public Apple Music playlist pages. No electron/node deps so it
// stays unit-testable. Apple no longer ships schema.org JSON-LD for playlists; the
// track data lives in the `serialized-server-data` JSON blob (the same data the
// web player hydrates from). We walk it generically rather than by fixed indices
// so it survives Apple reordering sections.
// ponytail: id-prefix heuristics ('track-lockup', 'playlist-detail-header'). If
// Apple renames those, this throws a friendly error rather than silently mis-parsing.

export interface ParsedAppleTrack {
  title: string
  artist: string
  position: number
}

export interface ParsedApplePlaylist {
  title: string
  artworkUrl?: string
  tracks: ParsedAppleTrack[]
}

export function isAppleMusicUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'music.apple.com' || host.endsWith('.music.apple.com')
  } catch {
    return /(^|\/\/|\.)music\.apple\.com\b/i.test(url)
  }
}

export function extractAppleListId(url: string): string | null {
  const m = url.match(/(pl\.[A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

function isObj(node: unknown): node is Record<string, unknown> {
  return !!node && typeof node === 'object'
}

function walkTrackRows(node: unknown, out: ParsedAppleTrack[]): void {
  if (!isObj(node)) return
  if (Array.isArray(node)) {
    for (const n of node) walkTrackRows(n, out)
    return
  }
  if (typeof node.id === 'string' && node.id.startsWith('track-lockup') && typeof node.title === 'string') {
    const artist = typeof node.artistName === 'string' && node.artistName.trim() ? node.artistName.trim() : 'Unknown Artist'
    out.push({ title: node.title.trim(), artist, position: out.length + 1 })
  }
  for (const k of Object.keys(node)) walkTrackRows(node[k], out)
}

function findHeaderNode(node: unknown): Record<string, unknown> | undefined {
  if (!isObj(node)) return undefined
  if (Array.isArray(node)) {
    for (const n of node) {
      const h = findHeaderNode(n)
      if (h) return h
    }
    return undefined
  }
  // Match the header *lockup item* (has title/artwork), not the wrapping
  // 'playlist-detail-header-section' which shares the id prefix.
  if (
    typeof node.id === 'string' &&
    node.id.startsWith('playlist-detail-header') &&
    ('artwork' in node || 'title' in node)
  ) {
    return node
  }
  for (const k of Object.keys(node)) {
    const h = findHeaderNode(node[k])
    if (h) return h
  }
  return undefined
}

// Apple artwork URLs are templates like ".../{w}x{h}{c}.{f}".
function resolveArtwork(url: string): string {
  return url.replace('{w}', '592').replace('{h}', '592').replace(/\{c\}/, '').replace('{f}', 'jpg')
}

function titleFromSeo(seo: string | undefined): string | undefined {
  if (!seo) return undefined
  // "Playlist Name by Author - Apple Music"
  const cleaned = seo.replace(/\s*-\s*Apple Music\s*$/, '')
  const byIdx = cleaned.lastIndexOf(' by ')
  return (byIdx > 0 ? cleaned.slice(0, byIdx) : cleaned).trim() || undefined
}

function seoPageTitle(data: unknown): string | undefined {
  try {
    // Deep dynamic access into Apple's blob; guarded by try/catch.
    const t = (data as { data: { data: { seoData: { pageTitle?: unknown } } }[] }).data[0].data.seoData.pageTitle
    return typeof t === 'string' ? t : undefined
  } catch {
    return undefined
  }
}

export function parseApplePlaylistHtml(html: string): ParsedApplePlaylist {
  const block = html.match(
    /<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/
  )
  if (!block) {
    throw new Error(
      'Could not read this Apple Music playlist. Make sure the link is a public playlist.'
    )
  }

  let data: unknown
  try {
    data = JSON.parse(block[1].trim())
  } catch {
    throw new Error('Apple Music playlist data was malformed.')
  }

  const tracks: ParsedAppleTrack[] = []
  walkTrackRows(data, tracks)
  if (!tracks.length) {
    throw new Error('No tracks found in this Apple Music playlist.')
  }

  const header = findHeaderNode(data)
  const headerTitle =
    header && typeof header.title === 'string' ? header.title.trim() : undefined
  const title = headerTitle || titleFromSeo(seoPageTitle(data)) || 'Apple Music Playlist'

  let artworkUrl: string | undefined
  const artwork = header?.artwork as { dictionary?: { url?: string } } | undefined
  if (artwork?.dictionary?.url) {
    artworkUrl = resolveArtwork(artwork.dictionary.url)
  }

  return { title, artworkUrl, tracks }
}
