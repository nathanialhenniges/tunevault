import { ipcMain, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { IpcChannels } from '../../shared/ipc-channels'
import { YtdlpService } from '../services/ytdlp.service'
import { FfmpegService } from '../services/ffmpeg.service'
import { LibraryService } from '../services/library.service'
import { MusicBrainzService } from '../services/musicbrainz.service'
import type { DownloadRequest, Track, DateFormat } from '../../shared/models'
import { formatDate, isRateLimitMessage } from '../../shared/utils'

const activeDownloads = new Map<string, AbortController>()
const activeBatches = new Map<string, { cancel: () => void; remaining: number }>()
const cancelledTracks = new Set<string>()
let batchSeq = 0 // ensures each DOWNLOAD_START gets a unique batch id
const RATE_LIMIT_WAIT_MS = 60_000 // Wait 60 seconds on rate limit
const MAX_RETRIES = 3

export function hasActiveDownloads(): boolean {
  return activeDownloads.size > 0 || activeBatches.size > 0
}

/** Abort all active downloads — called on app quit to prevent orphaned child processes */
export function abortAllDownloads(): void {
  for (const [, batch] of activeBatches) {
    batch.cancel()
  }
  activeBatches.clear()
  for (const [trackId, controller] of activeDownloads) {
    controller.abort()
    activeDownloads.delete(trackId)
  }
}

export function registerDownloadIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(IpcChannels.DOWNLOAD_START, async (_event, request: DownloadRequest) => {
    if (!request || !request.playlist || !Array.isArray(request.playlist.tracks)) {
      throw new Error('Invalid download request')
    }
    const { playlist, format, outputDir, forceRedownload, dateFormat, releaseDateSource } = request
    // Clamp concurrency to safe range (1–8)
    const concurrency = Math.max(1, Math.min(8, request.concurrency || 3))
    const ytdlp = new YtdlpService()
    const ffmpeg = new FfmpegService()
    const library = new LibraryService()
    const musicbrainz = new MusicBrainzService()
    const effectiveDateFormat: DateFormat = dateFormat || 'MM/DD/YYYY'

    const queue = [...playlist.tracks]
    const totalTracks = queue.length
    let active = 0
    let idx = 0
    let cancelled = false

    // 1.2 — Track remaining items per batch for proper cleanup. Use a unique id
    // (not playlist.id) so two concurrent downloads of the same playlist don't
    // clobber each other's batch state in activeBatches.
    const batchId = `${playlist.id}#${++batchSeq}`
    const batchState = { cancel: () => { cancelled = true }, remaining: totalTracks }
    activeBatches.set(batchId, batchState)

    const onTrackDone = (): void => {
      batchState.remaining--
      if (batchState.remaining <= 0) {
        activeBatches.delete(batchId)
      }
    }

    const processNext = (): void => {
      if (cancelled) return
      while (active < concurrency && idx < queue.length) {
        const track = queue[idx++]

        // Skip tracks that were individually cancelled while queued
        if (!activeDownloads.has(track.id) && cancelledTracks.has(track.id)) {
          cancelledTracks.delete(track.id)
          onTrackDone()
          continue
        }

        // Check if track already exists on disk — skip if so
        const expectedPath = ytdlp.trackOutputPath(outputDir, playlist.title, track, format)

        if (!forceRedownload && existsSync(expectedPath)) {
          mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, {
            trackId: track.id,
            videoId: track.videoId,
            percent: 100,
            speed: '',
            eta: '',
            status: 'skipped'
          })
          mainWindow.webContents.send(IpcChannels.DOWNLOAD_COMPLETE, {
            trackId: track.id,
            filePath: expectedPath
          })
          onTrackDone()
          continue
        }

        active++
        const controller = new AbortController()
        activeDownloads.set(track.id, controller)

        const downloadWithRetry = async (retries: number): Promise<string> => {
          try {
            return await ytdlp.download({
              track,
              format,
              outputDir,
              playlistTitle: playlist.title,
              onProgress: (progress) => {
                mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, progress)
              },
              signal: controller.signal
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (isRateLimitMessage(msg) && retries > 0 && !cancelled) {
              // Notify UI that we're paused due to rate limiting
              mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, {
                trackId: track.id,
                videoId: track.videoId,
                percent: 0,
                speed: '',
                eta: '',
                status: 'rate-limited' as const,
                error: `Rate limited — retrying in ${RATE_LIMIT_WAIT_MS / 1000}s`
              })
              await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS))
              if (cancelled || controller.signal.aborted) throw err
              return downloadWithRetry(retries - 1)
            }
            throw err
          }
        }

        downloadWithRetry(MAX_RETRIES)
          .then(async (filePath) => {
            // Tag with rich iTunes-compatible metadata
            mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, {
              trackId: track.id,
              videoId: track.videoId,
              percent: 100,
              speed: '',
              eta: '',
              status: 'tagging'
            })

            // Fetch metadata (release date + bitrate + description)
            let releaseDate: string | undefined
            let bitrate: number | undefined
            let description: string | undefined
            const trackUrl = track.sourceUrl || `https://www.youtube.com/watch?v=${track.videoId}`

            try {
              const meta = await ytdlp.fetchTrackMeta(trackUrl)
              bitrate = meta.bitrate
              description = meta.description

              if (releaseDateSource === 'musicbrainz') {
                const mbDate = await musicbrainz.lookupReleaseDate(track.artist, track.title)
                releaseDate = mbDate || meta.releaseDate
              } else {
                releaseDate = meta.releaseDate
              }
            } catch {
              // Non-blocking — continue without metadata
            }

            const formattedDate = releaseDate ? formatDate(releaseDate, effectiveDateFormat) : undefined

            try {
              await ffmpeg.tagFile(filePath, {
                title: track.title,
                artist: track.artist,
                album: playlist.title,
                albumArtist: playlist.channelTitle || track.artist,
                track: track.position,
                totalTracks,
                date: formattedDate,
                comment: `Downloaded from ${track.source === 'soundcloud' ? 'SoundCloud' : 'YouTube'} by TuneVault`,
                thumbnailUrl: track.thumbnailUrl,
                genre: 'Music'
              })
            } catch (err) {
              console.error(`Failed to tag ${track.title}:`, err)
              // Continue even if tagging fails — file is still downloaded
            }

            const updatedTrack: Track = {
              ...track,
              filePath,
              format,
              downloadedAt: new Date().toISOString(),
              releaseDate: formattedDate,
              bitrate,
              url: trackUrl,
              description
            }
            // Await the queued write so the track is persisted before we render
            // playlist-info.md from it (the write queue runs on a microtask).
            await library.upsertTrack(playlist, updatedTrack)
            library.writePlaylistInfo(ytdlp.playlistDir(outputDir, playlist.title), playlist.id)
            mainWindow.webContents.send(IpcChannels.DOWNLOAD_COMPLETE, {
              trackId: track.id,
              filePath
            })
          })
          .catch((err) => {
            if (controller.signal.aborted) {
              mainWindow.webContents.send(IpcChannels.DOWNLOAD_PROGRESS, {
                trackId: track.id,
                videoId: track.videoId,
                percent: 0,
                speed: '',
                eta: '',
                status: 'error',
                error: 'Cancelled'
              })
              return
            }
            mainWindow.webContents.send(IpcChannels.DOWNLOAD_ERROR, {
              trackId: track.id,
              error: err.message
            })
          })
          .finally(() => {
            active--
            activeDownloads.delete(track.id)
            onTrackDone()
            processNext()
          })
      }
    }

    processNext()
    return { started: queue.length }
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_CANCEL, async (_event, trackId: string) => {
    const controller = activeDownloads.get(trackId)
    if (controller) {
      controller.abort()
      activeDownloads.delete(trackId)
    } else {
      // Track is still queued — mark it so processNext skips it
      cancelledTracks.add(trackId)
    }
  })

  ipcMain.handle(IpcChannels.DOWNLOAD_CANCEL_ALL, async () => {
    abortAllDownloads()
  })
}
