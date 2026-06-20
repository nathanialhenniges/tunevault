import { useRef, useEffect, useCallback } from 'react'
import { analyserManager } from '../../lib/analyserManager'
import type { VisualizerStyle } from '../../store/visualizerStore'

interface VisualizerProps {
  enabled: boolean
  style: VisualizerStyle
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  accentRgb: string,
  gradientCache: { gradient: CanvasGradient; w: number; h: number } | null,
  setGradientCache: (cache: { gradient: CanvasGradient; w: number; h: number }) => void
): void {
  const bins = data.length
  const barW = w / bins

  let gradient: CanvasGradient
  if (gradientCache && gradientCache.w === w && gradientCache.h === h) {
    gradient = gradientCache.gradient
  } else {
    gradient = ctx.createLinearGradient(0, h, 0, 0)
    gradient.addColorStop(0, `rgba(${accentRgb}, 0.3)`)
    gradient.addColorStop(1, `rgb(${accentRgb})`)
    setGradientCache({ gradient, w, h })
  }

  ctx.fillStyle = gradient
  for (let i = 0; i < bins; i++) {
    const barH = (data[i] / 255) * h
    ctx.fillRect(i * barW, h - barH, barW - 1, barH)
  }
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  accentRgb: string
): void {
  ctx.lineWidth = 2
  ctx.strokeStyle = `rgb(${accentRgb})`
  ctx.beginPath()
  const sliceW = w / data.length
  for (let i = 0; i < data.length; i++) {
    const y = (data[i] / 255) * h
    if (i === 0) ctx.moveTo(0, y)
    else ctx.lineTo(i * sliceW, y)
  }
  ctx.stroke()
}

function drawCircular(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  accentRgb: string
): void {
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(cx, cy) * 0.4
  const bins = data.length
  const maxBarH = Math.min(cx, cy) - radius

  ctx.lineWidth = 2

  // Quantize alpha into 8 buckets and batch strokes
  const buckets: { x1: number; y1: number; x2: number; y2: number }[][] = Array.from({ length: 8 }, () => [])

  for (let i = 0; i < bins; i++) {
    const angle = (i / bins) * Math.PI * 2 - Math.PI / 2
    const barH = (data[i] / 255) * maxBarH
    const x1 = cx + Math.cos(angle) * radius
    const y1 = cy + Math.sin(angle) * radius
    const x2 = cx + Math.cos(angle) * (radius + barH)
    const y2 = cy + Math.sin(angle) * (radius + barH)
    const alpha = 0.3 + (data[i] / 255) * 0.7
    const bucket = Math.min(7, Math.floor(alpha * 8))
    buckets[bucket].push({ x1, y1, x2, y2 })
  }

  for (let b = 0; b < 8; b++) {
    const lines = buckets[b]
    if (lines.length === 0) continue
    const alpha = (b + 0.5) / 8
    ctx.strokeStyle = `rgba(${accentRgb}, ${alpha})`
    ctx.beginPath()
    for (const { x1, y1, x2, y2 } of lines) {
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
    }
    ctx.stroke()
  }
}

export function Visualizer({ enabled, style }: VisualizerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const gradientCacheRef = useRef<{ gradient: CanvasGradient; w: number; h: number } | null>(null)
  const accentRef = useRef('')
  // Reused across frames so we don't allocate a Uint8Array ~60×/sec.
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const analyser = analyserManager.getAnalyser()
    if (!analyser) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Follow the current accent (orange/blue); refresh the bar gradient if it changed.
    const accentRgb =
      getComputedStyle(canvas).getPropertyValue('--accent-rgb').trim() || '249, 115, 22'
    if (accentRef.current !== accentRgb) {
      accentRef.current = accentRgb
      gradientCacheRef.current = null
    }

    const size = style === 'waveform' ? analyser.fftSize : analyser.frequencyBinCount
    if (!dataRef.current || dataRef.current.length !== size) dataRef.current = new Uint8Array(size)
    const data = dataRef.current
    if (style === 'waveform') {
      analyser.getByteTimeDomainData(data)
      drawWaveform(ctx, data, w, h, accentRgb)
    } else {
      analyser.getByteFrequencyData(data)
      if (style === 'circular') drawCircular(ctx, data, w, h, accentRgb)
      else drawBars(ctx, data, w, h, accentRgb, gradientCacheRef.current, (c) => { gradientCacheRef.current = c })
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [style])

  useEffect(() => {
    if (!enabled) return

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled, draw])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      canvas.width = width * devicePixelRatio
      canvas.height = height * devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio)
      // Invalidate gradient cache on resize
      gradientCacheRef.current = null
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden transition-all duration-300 ${enabled ? 'h-[120px]' : 'h-0'}`}
      style={{
        background: enabled ? 'var(--glass-bg)' : 'transparent',
        backdropFilter: enabled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: enabled ? 'blur(12px)' : 'none',
        borderTop: enabled ? '1px solid var(--glass-border-edge)' : 'none'
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
