import { spawn } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { BinaryService } from './binary.service'
import https from 'https'
import http from 'http'
import { createWriteStream } from 'fs'

export class FfmpegService {
  private binary: BinaryService

  constructor() {
    this.binary = new BinaryService()
  }

  /**
   * Tag audio file with rich metadata compatible with iTunes/Apple Music.
   * Downloads album art from thumbnail URL and embeds it.
   */
  async tagFile(
    filePath: string,
    metadata: {
      title: string
      artist: string
      album: string
      albumArtist: string
      track: number
      totalTracks: number
      date?: string
      genre?: string
      comment?: string
      thumbnailUrl?: string
    }
  ): Promise<void> {
    const ffmpegPath = this.binary.getFfmpegPath()
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const tmpOutput = filePath + '.tagged' + ext
    let thumbnailPath: string | null = null

    // Download thumbnail for album art embedding
    if (metadata.thumbnailUrl) {
      thumbnailPath = filePath + '.thumb.jpg'
      try {
        await this.downloadFile(metadata.thumbnailUrl, thumbnailPath)
      } catch {
        thumbnailPath = null
      }
    }

    const args: string[] = ['-i', filePath]

    // Add thumbnail as second input if available
    if (thumbnailPath && existsSync(thumbnailPath)) {
      args.push('-i', thumbnailPath)
    }

    // Metadata tags (iTunes-compatible)
    args.push(
      '-metadata', `title=${metadata.title}`,
      '-metadata', `artist=${metadata.artist}`,
      '-metadata', `album=${metadata.album}`,
      '-metadata', `album_artist=${metadata.albumArtist}`,
      '-metadata', `track=${metadata.track}/${metadata.totalTracks}`,
      '-metadata', `disc=1/1`
    )

    if (metadata.date) {
      args.push('-metadata', `date=${metadata.date}`)
      // Also write release_date for players that read TDRL (full date, not just year)
      args.push('-metadata', `release_date=${metadata.date}`)
    }
    if (metadata.genre) {
      args.push('-metadata', `genre=${metadata.genre}`)
    }
    if (metadata.comment) {
      args.push('-metadata', `comment=${metadata.comment}`)
    }

    // Encoder tag
    args.push('-metadata', 'encoded_by=TuneVault')

    // Handle format-specific options
    if (ext === '.mp3') {
      // For MP3: use ID3v2.4 tags (supports full date in TDRC frame)
      args.push('-id3v2_version', '4')
      args.push('-codec:a', 'copy')

      if (thumbnailPath && existsSync(thumbnailPath)) {
        // Embed album art for MP3
        args.push(
          '-map', '0:a',
          '-map', '1:v',
          '-metadata:s:v', 'title=Album cover',
          '-metadata:s:v', 'comment=Cover (front)'
        )
      } else {
        args.push('-map', '0:a')
      }
    } else if (ext === '.flac') {
      // For FLAC: Vorbis comments + embedded picture
      args.push('-codec:a', 'copy')

      if (thumbnailPath && existsSync(thumbnailPath)) {
        args.push(
          '-map', '0:a',
          '-map', '1:v',
          '-metadata:s:v', 'title=Album cover',
          '-metadata:s:v', 'comment=Cover (front)',
          '-disposition:v', 'attached_pic'
        )
      } else {
        args.push('-map', '0:a')
      }
    } else if (ext === '.opus' || ext === '.ogg') {
      // For Opus: Vorbis comments
      args.push('-codec:a', 'copy')
      args.push('-map', '0:a')
      // Opus in ogg doesn't support embedded images via ffmpeg easily,
      // so skip album art for opus
    } else {
      args.push('-codec', 'copy')
      args.push('-map', '0:a')
    }

    args.push('-y', tmpOutput)

    try {
      await this.runFfmpeg(ffmpegPath, args)

      // Replace original with tagged version
      const fs = await import('fs/promises')
      await fs.rename(tmpOutput, filePath)
    } catch (err) {
      // Clean up temp file on error
      if (existsSync(tmpOutput)) unlinkSync(tmpOutput)
      throw err
    } finally {
      // Clean up thumbnail
      if (thumbnailPath && existsSync(thumbnailPath)) {
        unlinkSync(thumbnailPath)
      }
    }
  }

  /**
   * Set only the genre tag, preserving all existing streams (audio + cover art)
   * and other metadata. Fast: stream copy, no re-encode.
   */
  async setGenre(filePath: string, genre: string): Promise<void> {
    await this.setTags(filePath, { genre })
  }

  /**
   * Write one or more text tags (title/artist/genre) in place, preserving all
   * existing streams (audio + cover art) and other metadata. Stream copy, no
   * re-encode. Only the provided keys are written.
   */
  async setTags(
    filePath: string,
    tags: { title?: string; artist?: string; genre?: string }
  ): Promise<void> {
    const entries = Object.entries(tags).filter(([, v]) => v !== undefined) as [string, string][]
    if (!entries.length) return
    const ffmpegPath = this.binary.getFfmpegPath()
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const tmpOutput = filePath + '.tags' + ext
    const args = ['-i', filePath, '-map', '0', '-c', 'copy']
    for (const [k, v] of entries) args.push('-metadata', `${k}=${v}`)
    if (ext === '.mp3') args.push('-id3v2_version', '4')
    args.push('-y', tmpOutput)

    try {
      await this.runFfmpeg(ffmpegPath, args)
      const fs = await import('fs/promises')
      await fs.rename(tmpOutput, filePath)
    } catch (err) {
      if (existsSync(tmpOutput)) unlinkSync(tmpOutput)
      throw err
    }
  }

  /** Read tags + duration + bitrate from a local audio file via ffprobe. */
  async probe(
    filePath: string
  ): Promise<{
    title?: string
    artist?: string
    album?: string
    genre?: string
    duration: number
    bitrate?: number
  }> {
    const ffprobePath = this.binary.getFfprobePath()
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath]
    const out = await new Promise<string>((resolve, reject) => {
      const proc = spawn(ffprobePath, args)
      let s = ''
      proc.stdout?.on('data', (d: Buffer) => (s += d.toString()))
      proc.on('close', (code) => (code === 0 ? resolve(s) : reject(new Error('ffprobe failed'))))
      proc.on('error', reject)
    })
    try {
      const json = JSON.parse(out)
      const tags = (json.format?.tags ?? {}) as Record<string, unknown>
      const get = (k: string): string | undefined => {
        const key = Object.keys(tags).find((x) => x.toLowerCase() === k)
        return key && tags[key] != null ? String(tags[key]) : undefined
      }
      const duration = Math.round(parseFloat(String(json.format?.duration ?? '0'))) || 0
      const bitRate = parseInt(String(json.format?.bit_rate ?? '0'), 10)
      const bitrate = bitRate > 0 ? Math.round(bitRate / 1000) : undefined
      return {
        title: get('title'),
        artist: get('artist'),
        album: get('album'),
        genre: get('genre'),
        duration,
        bitrate
      }
    } catch {
      return { duration: 0 }
    }
  }

  /** Extract embedded cover art to destPath (jpg). Returns false if the file has none. */
  async extractCover(filePath: string, destPath: string): Promise<boolean> {
    const ffmpegPath = this.binary.getFfmpegPath()
    try {
      await this.runFfmpeg(ffmpegPath, ['-i', filePath, '-map', '0:v:0', '-frames:v', '1', '-y', destPath])
      return existsSync(destPath)
    } catch {
      return false
    }
  }

  /** Download an image (cover art) to destPath. Returns false on any failure (e.g. 404). */
  async fetchArtwork(imageUrl: string, destPath: string): Promise<boolean> {
    try {
      await this.downloadFile(imageUrl, destPath)
      return existsSync(destPath)
    } catch {
      return false
    }
  }

  /** Embed a local cover image into an existing audio file (mp3/flac), stream-copy
   *  audio. Other formats are skipped silently. */
  async embedArtwork(filePath: string, imagePath: string): Promise<void> {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
    if ((ext !== '.mp3' && ext !== '.flac') || !existsSync(imagePath)) return
    const ffmpegPath = this.binary.getFfmpegPath()
    const tmpOutput = filePath + '.art' + ext
    const args = [
      '-i', filePath, '-i', imagePath,
      '-map', '0:a', '-map', '1:v', '-c', 'copy',
      '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)'
    ]
    if (ext === '.flac') args.push('-disposition:v', 'attached_pic')
    if (ext === '.mp3') args.push('-id3v2_version', '4')
    args.push('-y', tmpOutput)
    try {
      await this.runFfmpeg(ffmpegPath, args)
      const fs = await import('fs/promises')
      await fs.rename(tmpOutput, filePath)
    } catch (err) {
      if (existsSync(tmpOutput)) unlinkSync(tmpOutput)
      throw err
    }
  }

  private downloadFile(url: string, destPath: string, redirects = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      if (redirects > 5) {
        reject(new Error('Too many redirects'))
        return
      }
      const client = url.startsWith('https') ? https : http
      const req = client.get(url, (response) => {
        const status = response.statusCode ?? 0
        // Follow redirects (301/302/303/307/308), resolving relative Locations.
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume() // drain so the socket frees
          const next = new URL(response.headers.location, url).href
          this.downloadFile(next, destPath, redirects + 1).then(resolve).catch(reject)
          return
        }
        // Reject error responses instead of piping the error body to disk.
        if (status < 200 || status >= 300) {
          response.resume()
          reject(new Error(`Request failed with status ${status}`))
          return
        }
        const file = createWriteStream(destPath)
        response.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', (err) => {
          file.close()
          if (existsSync(destPath)) unlinkSync(destPath)
          reject(err)
        })
      })
      req.setTimeout(30_000, () => req.destroy(new Error('Request timed out')))
      req.on('error', (err) => {
        if (existsSync(destPath)) unlinkSync(destPath)
        reject(err)
      })
    })
  }

  private runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args)
      let stderr = ''

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
      })

      proc.on('error', reject)
    })
  }
}
