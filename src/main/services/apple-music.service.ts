import { YouTubeService } from './youtube.service'
import { parseApplePlaylistHtml, extractAppleListId } from './apple-music-parse'
import type { Playlist, Track } from '../../shared/models'

// Pretend to be a desktop browser — Apple serves a minimal page to unknown agents.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ponytail: tiny inline concurrency limiter, no p-limit dep for one caller.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const idx = next++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export class AppleMusicService {
  private yt = new YouTubeService()

  static isAppleMusicUrl(url: string): boolean {
    return /(^|\.)music\.apple\.com\//.test(url)
  }

  async fetchPlaylist(url: string): Promise<Playlist> {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' }
    })
    if (!res.ok) {
      throw new Error(`Could not load the Apple Music page (HTTP ${res.status}).`)
    }
    const parsed = parseApplePlaylistHtml(await res.text())
    const playlistId = extractAppleListId(url) || url

    // Resolve each Apple Music track to a playable source via yt-dlp search:
    // YouTube first, SoundCloud as fallback.
    // ponytail: fixed concurrency 4 — bump if large playlists feel slow.
    const resolved = await mapLimit(parsed.tracks, 4, async (t): Promise<Track | null> => {
      const hit = await this.yt.searchVideo(`${t.artist} ${t.title}`)
      if (!hit) return null
      return {
        id: `${playlistId}_${hit.videoId}`,
        videoId: hit.videoId,
        title: t.title,
        artist: t.artist,
        duration: hit.duration,
        thumbnailUrl: hit.thumbnailUrl,
        playlistId,
        playlistTitle: parsed.title,
        position: t.position,
        sourceUrl: hit.sourceUrl,
        source: hit.source
      }
    })

    const tracks = resolved.filter((t): t is Track => t !== null)
    if (!tracks.length) {
      throw new Error('Could not find any of these tracks on YouTube.')
    }

    return {
      id: playlistId,
      title: parsed.title,
      channelTitle: 'Apple Music',
      thumbnailUrl: parsed.artworkUrl || tracks[0].thumbnailUrl,
      tracks,
      fetchedAt: new Date().toISOString()
    }
  }
}
