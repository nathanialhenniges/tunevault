import { app } from 'electron'
import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'

function getPlatformDir(): string {
  switch (process.platform) {
    case 'darwin':
      return 'mac'
    case 'win32':
      return 'win'
    default:
      return 'linux'
  }
}

function getExtension(): string {
  return process.platform === 'win32' ? '.exe' : ''
}

function getResourcesPath(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'resources', 'bin', getPlatformDir())
  }
  return join(process.resourcesPath, 'bin')
}

export class BinaryService {
  private basePath: string

  constructor() {
    this.basePath = getResourcesPath()
  }

  private resolve(name: string): string {
    const p = join(this.basePath, `${name}${getExtension()}`)
    if (!existsSync(p)) {
      throw new Error(`${name} binary not found at ${p}. Run "npm run download-binaries" first.`)
    }
    return p
  }

  getYtdlpPath(): string {
    return this.resolve('yt-dlp')
  }

  getFfmpegPath(): string {
    return this.resolve('ffmpeg')
  }

  getFfprobePath(): string {
    return this.resolve('ffprobe')
  }

  /**
   * Run yt-dlp with the given args, buffering stdout. Resolves stdout on a clean
   * exit; with `allowPartial`, also resolves when yt-dlp exits non-zero but still
   * produced output (e.g. --ignore-errors on a playlist with some dead entries).
   */
  runYtdlp(args: string[], opts: { allowPartial?: boolean } = {}): Promise<string> {
    const ytdlpPath = this.getYtdlpPath()
    return new Promise((resolve, reject) => {
      const proc = spawn(ytdlpPath, args)
      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (d: Buffer) => (stdout += d.toString()))
      proc.stderr?.on('data', (d: Buffer) => (stderr += d.toString()))
      proc.on('close', (code) => {
        if (code === 0 || (opts.allowPartial && stdout.trim())) {
          resolve(stdout)
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr.trim()}`.trim()))
        }
      })
      proc.on('error', (err) => reject(new Error(`Failed to run yt-dlp: ${err.message}`)))
    })
  }
}
