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
    const ffmpegPath = this.binary.getFfmpegPath()
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const tmpOutput = filePath + '.genre' + ext
    const args = ['-i', filePath, '-map', '0', '-c', 'copy', '-metadata', `genre=${genre}`]
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

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http
      const file = createWriteStream(destPath)

      client.get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject)
            return
          }
        }

        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      }).on('error', (err) => {
        file.close()
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

  private formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
}
