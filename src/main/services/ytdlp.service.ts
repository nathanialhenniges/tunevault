import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { mkdirSync, unlinkSync } from 'fs'
import { readdir } from 'fs/promises'
import { BinaryService } from './binary.service'
import type { Track, AudioFormat, DownloadProgress } from '../../shared/models'
import { sanitizeFilename, trackFileBaseName, isRateLimitMessage } from '../../shared/utils'

interface DownloadOptions {
  track: Track
  format: AudioFormat
  outputDir: string
  playlistTitle: string
  onProgress: (progress: DownloadProgress) => void
  signal: AbortSignal
}

export class YtdlpService {
  private binary: BinaryService

  constructor() {
    this.binary = new BinaryService()
  }

  /** Folder a playlist's audio is written to. */
  playlistDir(outputDir: string, playlistTitle: string): string {
    return join(outputDir, sanitizeFilename(playlistTitle))
  }

  /** Full on-disk path a track will be (or has been) written to. */
  trackOutputPath(outputDir: string, playlistTitle: string, track: Track, format: AudioFormat): string {
    // ext always equals format (flac/opus/mp3 map to their own names).
    return join(this.playlistDir(outputDir, playlistTitle), `${trackFileBaseName(track)}.${format}`)
  }

  async download(options: DownloadOptions): Promise<string> {
    const { track, format, outputDir, playlistTitle, onProgress, signal } = options

    const playlistDir = this.playlistDir(outputDir, playlistTitle)
    mkdirSync(playlistDir, { recursive: true })

    const filename = trackFileBaseName(track)
    const outputTemplate = join(playlistDir, `${filename}.%(ext)s`)

    const ytdlpPath = this.binary.getYtdlpPath()
    const ffmpegPath = this.binary.getFfmpegPath()

    const sourceUrl = track.sourceUrl || `https://www.youtube.com/watch?v=${track.videoId}`
    // Reject anything that isn't a real http(s) URL — a crafted sourceUrl/videoId
    // could otherwise smuggle yt-dlp flags via the positional arg.
    if (!/^https?:\/\//.test(sourceUrl)) {
      throw new Error(`Refusing to download a non-http(s) source: ${sourceUrl}`)
    }
    const args = [
      '-f',
      'bestaudio',
      '--extract-audio',
      '--audio-format',
      format,
      '--audio-quality',
      '0',
      '--newline',
      '--progress',
      '--no-warnings',
      '--ffmpeg-location',
      ffmpegPath,
      '-o',
      outputTemplate,
      '--embed-thumbnail',
      '--add-metadata',
      // `--` terminates options so a URL starting with '-' is never read as a flag.
      '--',
      sourceUrl
    ]

    return new Promise<string>((resolve, reject) => {
      const proc: ChildProcess = spawn(ytdlpPath, args)
      let outputPath = ''
      let rateLimited = false

      signal.addEventListener('abort', () => {
        proc.kill('SIGTERM')
        reject(new Error('Download cancelled'))
      })

      onProgress({
        trackId: track.id,
        videoId: track.videoId,
        percent: 0,
        speed: '',
        eta: '',
        status: 'downloading'
      })

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString()

        // Parse progress from --newline output
        const progressMatch = line.match(/(\d+\.?\d*)%/)
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1])
          const speedMatch = line.match(/(\d+\.?\d*\s*[KMG]iB\/s)/)
          const etaMatch = line.match(/ETA\s+(\S+)/)

          onProgress({
            trackId: track.id,
            videoId: track.videoId,
            percent,
            speed: speedMatch?.[1] ?? '',
            eta: etaMatch?.[1] ?? '',
            status: percent >= 100 ? 'converting' : 'downloading'
          })
        }

        // Capture output file path
        const destMatch = line.match(/Destination:\s+(.+)/)
        if (destMatch) {
          outputPath = destMatch[1].trim()
        }
        const mergeMatch = line.match(/\[ExtractAudio\] Destination:\s+(.+)/)
        if (mergeMatch) {
          outputPath = mergeMatch[1].trim()
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString()
        // yt-dlp writes some output to stderr, check for actual errors
        if (line.includes('ERROR')) {
          // Detect rate limiting (HTTP 429)
          if (isRateLimitMessage(line)) {
            rateLimited = true
            onProgress({
              trackId: track.id,
              videoId: track.videoId,
              percent: 0,
              speed: '',
              eta: '',
              status: 'error',
              error: 'RATE_LIMITED'
            })
          } else {
            onProgress({
              trackId: track.id,
              videoId: track.videoId,
              percent: 0,
              speed: '',
              eta: '',
              status: 'error',
              error: line.trim()
            })
          }
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          onProgress({
            trackId: track.id,
            videoId: track.videoId,
            percent: 100,
            speed: '',
            eta: '',
            status: 'done'
          })

          // Determine the actual output path (ext always equals format)
          const finalPath = outputPath || join(playlistDir, `${filename}.${format}`)

          // Clean up temp files left by yt-dlp (webm, m4a, part, jpg, webp, etc.)
          readdir(playlistDir).then((files) => {
            const tempExts = ['.webm', '.m4a', '.part', '.jpg', '.webp', '.png', '.temp', '.tmp']
            for (const file of files) {
              if (file.startsWith(filename) && !file.endsWith(`.${format}`)) {
                const fileExt = file.substring(file.lastIndexOf('.'))
                if (tempExts.includes(fileExt) || file.includes('.temp')) {
                  try { unlinkSync(join(playlistDir, file)) } catch { /* ignore */ }
                }
              }
            }
          }).catch(() => { /* ignore cleanup errors */ })

          resolve(finalPath)
        } else {
          // Surface rate-limiting in the rejection so the queue's retry logic can
          // detect it (stderr-only signalling never reached the caller before).
          reject(new Error(rateLimited ? 'RATE_LIMITED' : `yt-dlp exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        reject(err)
      })
    })
  }

  async dumpJson(url: string): Promise<Record<string, unknown>> {
    const output = await this.binary.runYtdlp(['--dump-json', '--no-warnings', '--', url])
    try {
      return JSON.parse(output)
    } catch {
      throw new Error('Failed to parse yt-dlp JSON output')
    }
  }

  async fetchTrackMeta(url: string): Promise<{ releaseDate?: string; bitrate?: number; description?: string }> {
    try {
      const json = await this.dumpJson(url)
      const releaseDate = (json.release_date as string) || (json.upload_date as string) || undefined
      const bitrate = typeof json.abr === 'number' ? Math.round(json.abr) : undefined
      const description = typeof json.description === 'string' ? json.description : undefined
      return { releaseDate, bitrate, description }
    } catch {
      return {}
    }
  }
}
