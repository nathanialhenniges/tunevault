// Pure parser for public Apple Music playlist pages. No electron/node deps so it
// stays unit-testable. Apple embeds a schema.org JSON-LD block for SEO; that's a
// far more stable shape than the internal serialized-server-data blob.
// ponytail: JSON-LD only. If Apple ever caps the track[] list, revisit with the
// serialized-server-data blob — brittler, so not worth it until it actually bites.

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

export function extractAppleListId(url: string): string | null {
  const m = url.match(/(pl\.[A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

function artistOf(track: Record<string, unknown>): string {
  const a = track.byArtist
  if (Array.isArray(a)) {
    const names = a.map((x) => (x as { name?: string })?.name).filter(Boolean)
    return names.length ? names.join(', ') : 'Unknown Artist'
  }
  if (a && typeof a === 'object') {
    return ((a as { name?: string }).name ?? 'Unknown Artist').toString()
  }
  return 'Unknown Artist'
}

export function parseApplePlaylistHtml(html: string): ParsedApplePlaylist {
  const block = html.match(
    /<script[^>]*id="schema:music-playlist"[^>]*>([\s\S]*?)<\/script>/
  )
  if (!block) {
    throw new Error(
      'Could not read this Apple Music playlist. Make sure the link is a public playlist.'
    )
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(block[1].trim())
  } catch {
    throw new Error('Apple Music playlist data was malformed.')
  }

  const rawTracks = Array.isArray(data.track) ? (data.track as Record<string, unknown>[]) : []
  const tracks: ParsedAppleTrack[] = rawTracks
    .map((t, i) => ({
      title: ((t?.name as string) ?? '').toString().trim(),
      artist: artistOf(t),
      position: i + 1
    }))
    .filter((t) => t.title)

  if (!tracks.length) {
    throw new Error('No tracks found in this Apple Music playlist.')
  }

  return {
    title: ((data.name as string) ?? 'Apple Music Playlist').toString().trim(),
    artworkUrl: typeof data.image === 'string' ? (data.image as string) : undefined,
    tracks
  }
}
