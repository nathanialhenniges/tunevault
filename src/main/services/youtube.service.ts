import { BinaryService } from './binary.service'
import type { Playlist, Track } from '../../shared/models'

interface YtdlpFlatEntry {
  id: string
  title: string
  url: string
  duration: number | null
  uploader: string
  channel: string
  thumbnails?: Array<{ url: string; width?: number; height?: number }>
  thumbnail?: string
  webpage_url?: string
  playlist_title: string
  playlist_id: string
  playlist_index: number
  [key: string]: unknown
}

export class YouTubeService {
  private binary: BinaryService

  constructor() {
    this.binary = new BinaryService()
  }

  extractPlaylistId(url: string): string | null {
    const patterns = [
      /[?&]list=([a-zA-Z0-9_-]+)/,
      /^(PL[a-zA-Z0-9_-]+)$/,
      /^(UU[a-zA-Z0-9_-]+)$/,
      /^(OLAK[a-zA-Z0-9_-]+)$/
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  async fetchPlaylist(playlistUrl: string): Promise<Playlist> {
    const entries = await this.runYtdlpFlat(playlistUrl)

    if (entries.length === 0) {
      throw new Error('No tracks found in playlist. It may be empty, private, or the URL is invalid.')
    }

    const first = entries[0]
    const playlistId = first.playlist_id || this.extractPlaylistId(playlistUrl) || playlistUrl
    const playlistTitle = first.playlist_title || 'Unknown Playlist'

    // Pick the best thumbnail from the first entry
    const thumbnailUrl = this.pickThumbnail(first)

    const tracks: Track[] = entries.map((entry, idx) => ({
      id: `${playlistId}_${entry.id}`,
      videoId: entry.id,
      title: entry.title || 'Unknown Title',
      artist: entry.channel || entry.uploader || 'Unknown Artist',
      duration: entry.duration ?? 0,
      thumbnailUrl: this.pickThumbnail(entry),
      playlistId,
      playlistTitle,
      position: entry.playlist_index ?? idx + 1
    }))

    return {
      id: playlistId,
      title: playlistTitle,
      channelTitle: first.channel || first.uploader || '',
      thumbnailUrl,
      tracks,
      fetchedAt: new Date().toISOString()
    }
  }

  /**
   * Resolve a free-text query to the top hit. Tries YouTube first, falls back to
   * SoundCloud (both via yt-dlp's built-in search). Used by Apple Music import.
   */
  async searchVideo(query: string): Promise<{
    videoId: string
    title: string
    duration: number
    thumbnailUrl: string
    sourceUrl: string
    source: 'youtube' | 'soundcloud'
  } | null> {
    const sources = [
      { prefix: 'ytsearch1:', source: 'youtube' as const },
      { prefix: 'scsearch1:', source: 'soundcloud' as const }
    ]
    for (const { prefix, source } of sources) {
      let entry: YtdlpFlatEntry | undefined
      try {
        entry = (await this.runYtdlpFlat(`${prefix}${query}`))[0]
      } catch {
        // Search backend failed/returned nothing — try the next source.
        continue
      }
      if (!entry) continue
      return {
        videoId: entry.id,
        title: entry.title,
        duration: entry.duration ?? 0,
        thumbnailUrl: this.pickThumbnail(entry, source),
        sourceUrl:
          source === 'youtube'
            ? `https://www.youtube.com/watch?v=${entry.id}`
            : entry.webpage_url || entry.url || '',
        source
      }
    }
    return null
  }

  private pickThumbnail(entry: YtdlpFlatEntry, source: 'youtube' | 'soundcloud' = 'youtube'): string {
    // yt-dlp provides thumbnails array sorted by quality; pick a mid-high one
    if (entry.thumbnails?.length) {
      // Prefer a thumbnail around 480px wide, or the last (highest quality)
      const preferred = entry.thumbnails.find((t) => (t.width ?? 0) >= 480)
      return preferred?.url ?? entry.thumbnails[entry.thumbnails.length - 1].url
    }
    if (entry.thumbnail) return entry.thumbnail
    // The bare-id fallback only resolves for YouTube.
    return source === 'youtube' ? `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg` : ''
  }

  private async runYtdlpFlat(playlistUrl: string): Promise<YtdlpFlatEntry[]> {
    const stdout = await this.binary.runYtdlp(
      // `--` terminates options so a search term / URL starting with '-' is treated
      // as a positional arg, never a flag.
      ['--flat-playlist', '--dump-json', '--no-warnings', '--ignore-errors', '--', playlistUrl],
      { allowPartial: true }
    )

    // Each line is a separate JSON object (one per track)
    const entries: YtdlpFlatEntry[] = []
    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue
      try {
        entries.push(JSON.parse(line) as YtdlpFlatEntry)
      } catch {
        // Skip malformed lines
      }
    }
    return entries
  }
}
