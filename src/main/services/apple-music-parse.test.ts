import { describe, it, expect } from 'vitest'
import { parseApplePlaylistHtml, extractAppleListId } from './apple-music-parse'

const jsonLd = {
  '@type': 'MusicPlaylist',
  name: 'Road Trip',
  image: 'https://example.com/art.jpg',
  track: [
    { name: 'Song A', byArtist: [{ name: 'Artist One' }] },
    { name: 'Song B', byArtist: { name: 'Artist Two' } }, // single object form
    { name: '', byArtist: [{ name: 'Skipped' }] } // empty title -> dropped
  ]
}

const html = `<html><head>
<script id="schema:music-playlist" type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head></html>`

describe('parseApplePlaylistHtml', () => {
  it('extracts title, artwork, and tracks across artist shapes', () => {
    const result = parseApplePlaylistHtml(html)
    expect(result.title).toBe('Road Trip')
    expect(result.artworkUrl).toBe('https://example.com/art.jpg')
    expect(result.tracks).toEqual([
      { title: 'Song A', artist: 'Artist One', position: 1 },
      { title: 'Song B', artist: 'Artist Two', position: 2 }
    ])
  })

  it('throws a friendly error when the JSON-LD block is missing', () => {
    expect(() => parseApplePlaylistHtml('<html></html>')).toThrow(/public playlist/)
  })
})

describe('extractAppleListId', () => {
  it('pulls the pl. id out of a full URL', () => {
    expect(
      extractAppleListId('https://music.apple.com/us/playlist/road-trip/pl.u-abc123XYZ')
    ).toBe('pl.u-abc123XYZ')
  })

  it('returns null when there is no playlist id', () => {
    expect(extractAppleListId('https://music.apple.com/us/album/foo/123')).toBeNull()
  })
})
