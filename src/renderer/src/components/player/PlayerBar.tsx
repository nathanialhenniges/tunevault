import { useState, useRef, memo } from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { useShallow } from 'zustand/react/shallow'
import { audioEngine } from '../../lib/audioEngine'
import { NowPlaying } from './NowPlaying'
import { VolumeControl } from './VolumeControl'
import { QueueView } from './QueueView'
import type { RepeatMode } from '../../store/playerStore'
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  QueueListIcon,
  SignalIcon
} from '@heroicons/react/24/solid'
import { useVisualizerStore } from '../../store/visualizerStore'
import type { VisualizerStyle } from '../../store/visualizerStore'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function RepeatIcon({ mode }: { mode: RepeatMode }): JSX.Element {
  return (
    <span className="relative">
      <ArrowPathIcon className="w-4 h-4" />
      {mode === 'one' && (
        <span className="absolute -top-1 -right-1.5 text-[8px] font-bold">1</span>
      )}
    </span>
  )
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const CROSSFADE_OPTIONS = [0, 2, 4, 6]
const VISUALIZER_STYLES: { value: VisualizerStyle; label: string }[] = [
  { value: 'bars', label: 'Bars' },
  { value: 'waveform', label: 'Waveform' },
  { value: 'circular', label: 'Circular' }
]

const SeekBar = memo(function SeekBar() {
  const [isSeeking, setIsSeeking] = useState(false)
  const seekValueRef = useRef(0)
  const seek = usePlayerStore((s) => s.seek)
  const duration = usePlayerStore((s) => s.duration)

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const time = parseFloat(e.target.value)
    seekValueRef.current = time
    setIsSeeking(true)
    usePlayerStore.getState().setSeek(time)
  }

  const handleSeekCommit = (): void => {
    audioEngine.seek(seekValueRef.current)
    setIsSeeking(false)
  }

  return (
    <div className="flex items-center gap-2 w-full max-w-lg">
      <span className="text-xs text-text-muted w-10 text-right">{formatTime(seek)}</span>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={isSeeking ? seekValueRef.current : seek}
        onChange={handleSeekInput}
        onMouseUp={handleSeekCommit}
        onTouchEnd={handleSeekCommit}
        className="flex-1 h-1 appearance-none seek-track rounded-full cursor-pointer"
        aria-label="Seek"
      />
      <span className="text-xs text-text-muted w-10">{formatTime(duration)}</span>
    </div>
  )
})

export function PlayerBar(): JSX.Element {
  const [showQueue, setShowQueue] = useState(false)
  const [showCrossfadeMenu, setShowCrossfadeMenu] = useState(false)
  const [showVisualizerMenu, setShowVisualizerMenu] = useState(false)

  const {
    isPlaying, togglePlay, next, prev, shuffle, repeat,
    toggleShuffle, setRepeat, currentTrack,
    playbackRate, setPlaybackRate, crossfadeDuration, setCrossfadeDuration
  } = usePlayerStore(useShallow((s) => ({
    isPlaying: s.isPlaying,
    togglePlay: s.togglePlay,
    next: s.next,
    prev: s.prev,
    shuffle: s.shuffle,
    repeat: s.repeat,
    toggleShuffle: s.toggleShuffle,
    setRepeat: s.setRepeat,
    currentTrack: s.currentTrack,
    playbackRate: s.playbackRate,
    setPlaybackRate: s.setPlaybackRate,
    crossfadeDuration: s.crossfadeDuration,
    setCrossfadeDuration: s.setCrossfadeDuration
  })))

  const { visualizerEnabled, toggleVisualizer, setVisualizerStyle } = useVisualizerStore(useShallow((s) => ({
    visualizerEnabled: s.enabled,
    toggleVisualizer: s.toggle,
    setVisualizerStyle: s.setStyle
  })))

  const cycleSpeed = (): void => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate)
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]
    setPlaybackRate(next)
  }

  const cycleRepeat = (): void => {
    const modes: RepeatMode[] = ['off', 'all', 'one']
    const idx = modes.indexOf(repeat)
    setRepeat(modes[(idx + 1) % modes.length])
  }

  return (
    <div className="relative h-20 glass-chrome glass-border-player flex items-center px-4 gap-4 transition-colors duration-200">
      <NowPlaying />

      <div className="flex-1 flex flex-col items-center gap-1">
        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={`transition ${shuffle ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
            title="Shuffle"
            aria-label="Shuffle"
            aria-pressed={shuffle}
          >
            <ArrowsRightLeftIcon className="w-4 h-4" />
          </button>

          <button onClick={prev} className="text-text-secondary hover:text-text-primary transition" aria-label="Previous track">
            <BackwardIcon className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="btn-accent w-10 h-10 flex items-center justify-center rounded-full hover:scale-105 transition"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>

          <button onClick={next} className="text-text-secondary hover:text-text-primary transition" aria-label="Next track">
            <ForwardIcon className="w-5 h-5" />
          </button>

          <button
            onClick={cycleRepeat}
            className={`transition ${repeat !== 'off' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
            title={`Repeat: ${repeat}`}
            aria-label={`Repeat: ${repeat}`}
          >
            <RepeatIcon mode={repeat} />
          </button>
        </div>

        {/* Seek bar */}
        <SeekBar />
      </div>

      <div className="flex items-center gap-2 w-64 justify-end relative">
        <button
          onClick={cycleSpeed}
          className={`text-xs font-medium px-1.5 py-0.5 rounded transition min-w-[2.5rem] ${
            playbackRate !== 1
              ? 'text-accent bg-accent/10'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          title={`Speed: ${playbackRate}x`}
          aria-label={`Playback speed: ${playbackRate}x`}
        >
          {playbackRate}x
        </button>
        <div className="relative">
          <button
            onClick={() => setShowCrossfadeMenu(!showCrossfadeMenu)}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition ${
              crossfadeDuration > 0
                ? 'text-accent bg-accent/10'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            title={`Crossfade: ${crossfadeDuration === 0 ? 'Off' : `${crossfadeDuration}s`}`}
            aria-label="Crossfade duration"
          >
            {crossfadeDuration === 0 ? 'CF' : `${crossfadeDuration}s`}
          </button>
          {showCrossfadeMenu && (
            <div className="absolute bottom-full right-0 mb-1 glass-float glass-border-float py-1 min-w-[5rem]" style={{ borderRadius: 'var(--radius-card)' }}>
              {CROSSFADE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setCrossfadeDuration(opt); setShowCrossfadeMenu(false) }}
                  className={`w-full px-3 py-1 text-xs text-left hover:bg-glass-hover transition ${
                    crossfadeDuration === opt ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {opt === 0 ? 'Off' : `${opt}s`}
                </button>
              ))}
            </div>
          )}
        </div>
        <VolumeControl />
        <div className="relative">
          <button
            onClick={toggleVisualizer}
            onContextMenu={(e) => { e.preventDefault(); setShowVisualizerMenu(!showVisualizerMenu) }}
            className={`transition ${visualizerEnabled ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
            title="Visualizer (right-click for style)"
            aria-label="Visualizer"
            aria-pressed={visualizerEnabled}
          >
            <SignalIcon className="w-4 h-4" />
          </button>
          {showVisualizerMenu && (
            <div className="absolute bottom-full right-0 mb-1 glass-float glass-border-float py-1 min-w-[6rem]" style={{ borderRadius: 'var(--radius-card)' }}>
              {VISUALIZER_STYLES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    setVisualizerStyle(value)
                    setShowVisualizerMenu(false)
                  }}
                  className={`w-full px-3 py-1 text-xs text-left hover:bg-glass-hover transition ${
                    useVisualizerStore.getState().style === value ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowQueue(!showQueue)}
          className="text-text-secondary hover:text-text-primary transition"
          title="Queue"
          aria-label="Queue"
          aria-expanded={showQueue}
        >
          <QueueListIcon className="w-5 h-5" />
        </button>
        <QueueView open={showQueue} onClose={() => setShowQueue(false)} />
      </div>
    </div>
  )
}
