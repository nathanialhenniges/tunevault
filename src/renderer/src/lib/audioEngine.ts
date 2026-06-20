import { Howl } from 'howler'

type AudioEventCallback = () => void
type SeekCallback = (seek: number) => void

export class AudioEngine {
  private howl: Howl | null = null
  private soundId: number | null = null
  private seekInterval: ReturnType<typeof setInterval> | null = null
  private onEndCallback: AudioEventCallback | null = null
  private onSeekUpdate: SeekCallback | null = null
  private onLoadCallback: ((duration: number) => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null
  private _playing = false
  private _rate = 1

  // For crossfade
  private nextHowl: Howl | null = null
  private nextSoundId: number | null = null
  private fadeTimer: ReturnType<typeof setInterval> | null = null

  private clearFade(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer)
      this.fadeTimer = null
    }
  }

  load(
    src: string,
    callbacks?: {
      onLoad?: (duration: number) => void
      onEnd?: () => void
      onSeek?: (seek: number) => void
      onError?: (error: string) => void
    }
  ): void {
    this.unload()

    // Register callbacks BEFORE creating Howl to avoid race conditions
    if (callbacks?.onLoad) this.onLoadCallback = callbacks.onLoad
    if (callbacks?.onEnd) this.onEndCallback = callbacks.onEnd
    if (callbacks?.onSeek) this.onSeekUpdate = callbacks.onSeek
    if (callbacks?.onError) this.onErrorCallback = callbacks.onError

    this.howl = new Howl({
      src: [src],
      html5: false, // Use Web Audio API — fully buffers the file so seeking always works
      volume: 1,
      rate: this._rate,
      onend: () => {
        this._playing = false
        this.stopSeekUpdates()
        this.onEndCallback?.()
      },
      onplay: (id) => {
        this.soundId = id
        this._playing = true
      },
      onload: () => {
        const duration = this.howl?.duration() ?? 0
        this.onLoadCallback?.(duration)
      },
      onloaderror: (_id, error) => {
        console.error('Howler load error:', error)
        this.onErrorCallback?.(String(error))
      },
      onplayerror: (_id, error) => {
        console.error('Howler play error:', error)
        // Attempt to unlock audio context and retry
        if (this.howl) {
          this.howl.once('unlock', () => {
            this.howl?.play()
          })
        }
      }
    })
  }

  loadNext(
    src: string,
    callbacks?: {
      onLoad?: (duration: number) => void
      onEnd?: () => void
      onSeek?: (seek: number) => void
      onError?: (error: string) => void
    }
  ): void {
    // Clean up any previous next howl
    if (this.nextHowl) {
      this.nextHowl.unload()
      this.nextHowl = null
      this.nextSoundId = null
    }

    // Store callbacks for when crossfade completes and next becomes current
    const nextCallbacks = { ...callbacks }

    this.nextHowl = new Howl({
      src: [src],
      html5: false,
      volume: 0,
      rate: this._rate,
      onend: () => {
        this._playing = false
        this.stopSeekUpdates()
        nextCallbacks.onEnd?.()
      },
      onplay: (id) => {
        this.nextSoundId = id
      },
      onload: () => {
        const duration = this.nextHowl?.duration() ?? 0
        nextCallbacks.onLoad?.(duration)
      },
      onloaderror: (_id, error) => {
        console.error('Howler load error (next):', error)
        nextCallbacks.onError?.(String(error))
      },
      onplayerror: (_id, error) => {
        console.error('Howler play error (next):', error)
        if (this.nextHowl) {
          this.nextHowl.once('unlock', () => {
            this.nextHowl?.play()
          })
        }
      }
    })

    // Store the seek callback for after promotion
    this._pendingSeekCallback = nextCallbacks.onSeek ?? null
    this._pendingEndCallback = nextCallbacks.onEnd ?? null
  }

  private _pendingSeekCallback: SeekCallback | null = null
  private _pendingEndCallback: AudioEventCallback | null = null

  crossfadeTo(duration: number): void {
    if (!this.nextHowl) return
    // Cancel any crossfade already in flight before starting a new one.
    this.clearFade()

    const currentHowl = this.howl
    const nextHowl = this.nextHowl
    const currentVolume = currentHowl?.volume() ?? 1
    const steps = 20
    const interval = (duration * 1000) / steps
    let step = 0

    // Start playing the next track
    nextHowl.play()

    this.fadeTimer = setInterval(() => {
      step++
      const progress = step / steps

      // Fade out current
      if (currentHowl) {
        currentHowl.volume(currentVolume * (1 - progress))
      }
      // Fade in next
      nextHowl.volume(progress)

      if (step >= steps) {
        this.clearFade()
        // Unload old howl
        if (currentHowl) {
          currentHowl.unload()
        }
        // Promote next to current
        this.howl = nextHowl
        this.soundId = this.nextSoundId
        this.nextHowl = null
        this.nextSoundId = null
        this._playing = true

        // Wire up seek and end callbacks
        if (this._pendingSeekCallback) {
          this.onSeekUpdate = this._pendingSeekCallback
          this._pendingSeekCallback = null
        }
        if (this._pendingEndCallback) {
          this.onEndCallback = this._pendingEndCallback
          this._pendingEndCallback = null
        }
        this.startSeekUpdates()
      }
    }, interval)
  }

  play(): void {
    if (!this.howl) return
    if (this.soundId != null) {
      this.howl.play(this.soundId)
    } else {
      this.soundId = this.howl.play()
    }
    this._playing = true
    this.startSeekUpdates()
  }

  pause(): void {
    if (this.howl && this.soundId != null) {
      this.howl.pause(this.soundId)
    } else {
      this.howl?.pause()
    }
    this._playing = false
    this.stopSeekUpdates()
  }

  stop(): void {
    this.howl?.stop()
    this._playing = false
    this.stopSeekUpdates()
  }

  seek(time: number): void {
    if (!this.howl) return
    if (this.soundId != null) {
      this.howl.seek(time, this.soundId)
    } else {
      this.howl.seek(time)
    }
    if (this._playing) {
      // Re-ensure playback continues after seeking with html5 audio
      if (this.soundId != null) {
        this.howl.play(this.soundId)
      } else {
        this.howl.play()
      }
      this.startSeekUpdates()
    }
  }

  setVolume(volume: number): void {
    this.howl?.volume(volume)
  }

  setRate(rate: number): void {
    this._rate = rate
    this.howl?.rate(rate)
    if (this.nextHowl) this.nextHowl.rate(rate)
  }

  getSeek(): number {
    return (this.howl?.seek() as number) ?? 0
  }

  getDuration(): number {
    return this.howl?.duration() ?? 0
  }

  isPlaying(): boolean {
    return this.howl?.playing() ?? false
  }

  unload(): void {
    this.stopSeekUpdates()
    // Kill any in-flight crossfade so its timer can't mutate/promote a howl we're
    // about to unload (which would corrupt playback when the track changes mid-fade).
    this.clearFade()
    if (this.howl) {
      this.howl.unload()
      this.howl = null
    }
    if (this.nextHowl) {
      this.nextHowl.unload()
      this.nextHowl = null
    }
    this.soundId = null
    this.nextSoundId = null
    this._playing = false
    this.onEndCallback = null
    this.onSeekUpdate = null
    this.onLoadCallback = null
    this.onErrorCallback = null
    this._pendingSeekCallback = null
    this._pendingEndCallback = null
  }

  private startSeekUpdates(): void {
    this.stopSeekUpdates()
    this.seekInterval = setInterval(() => {
      if (this.howl?.playing()) {
        const seek = this.howl.seek() as number
        this.onSeekUpdate?.(seek)
      }
    }, 250)
  }

  private stopSeekUpdates(): void {
    if (this.seekInterval) {
      clearInterval(this.seekInterval)
      this.seekInterval = null
    }
  }
}

export const audioEngine = new AudioEngine()
