import { describe, it, expect } from 'vitest'
import { parseApplePlaylistHtml, extractAppleListId, isAppleMusicUrl } from './apple-music-parse'

describe('isAppleMusicUrl', () => {
  it('matches real https Apple Music playlist URLs', () => {
    expect(isAppleMusicUrl('https://music.apple.com/us/playlist/ifc/pl.u-8aAVXLVcvWL0yke')).toBe(true)
  })

  it('matches without scheme', () => {
    expect(isAppleMusicUrl('music.apple.com/us/playlist/foo/pl.abc')).toBe(true)
  })

  it('rejects YouTube and lookalike hosts', () => {
    expect(isAppleMusicUrl('https://www.youtube.com/playlist?list=PLxyz')).toBe(false)
    expect(isAppleMusicUrl('https://music.apple.com.evil.test/pl.abc')).toBe(false)
  })
})

// Mirrors the real Apple `serialized-server-data` shape: root.data[0].data.sections,
// with a playlist-detail-header section and track-lockup rows.
const blob = {
  data: [
    {
      data: {
        seoData: { pageTitle: 'Road Trip by Me - Apple Music' },
        sections: [
          {
            id: 'playlist-detail-header-section - pl.x',
            items: [
              {
                id: 'playlist-detail-header - pl.x',
                title: 'Road Trip',
                artwork: { dictionary: { url: 'https://img.test/{w}x{h}{c}.{f}' } }
              }
            ]
          },
          {
            id: 'track-list',
            items: [
              { id: 'track-lockup - pl.x - 1', title: 'Song A', artistName: 'Artist One' },
              { id: 'track-lockup - pl.x - 2', title: 'Song B', artistName: 'Artist Two' },
              { id: 'featured-artists - 99', title: 'Not A Track' } // no track-lockup id -> ignored
            ]
          }
        ]
      }
    }
  ]
}

const html = `<html><head>
<script id="serialized-server-data" type="application/json">${JSON.stringify(blob)}</script>
</head></html>`

describe('parseApplePlaylistHtml', () => {
  it('extracts title, artwork, and track rows from serialized-server-data', () => {
    const result = parseApplePlaylistHtml(html)
    expect(result.title).toBe('Road Trip')
    expect(result.artworkUrl).toBe('https://img.test/592x592.jpg')
    expect(result.tracks).toEqual([
      { title: 'Song A', artist: 'Artist One', position: 1 },
      { title: 'Song B', artist: 'Artist Two', position: 2 }
    ])
  })

  it('falls back to the SEO page title when no header title is present', () => {
    const noHeader = `<script id="serialized-server-data" type="application/json">${JSON.stringify({
      data: [{ data: { seoData: { pageTitle: 'Chill Mix by Someone - Apple Music' }, sections: [
        { id: 'track-list', items: [{ id: 'track-lockup - pl.y - 1', title: 'X', artistName: 'Y' }] }
      ] } }]
    })}</script>`
    expect(parseApplePlaylistHtml(noHeader).title).toBe('Chill Mix')
  })

  it('throws a friendly error when the data blob is missing', () => {
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
