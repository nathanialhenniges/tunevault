import type { DateFormat } from './models'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(raw: string, format: DateFormat): string {
  // Normalize: YYYYMMDD -> YYYY-MM-DD
  const normalized = raw.length === 8
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw
  const parts = normalized.split('-')
  if (parts.length < 3) return raw
  const [yyyy, mm, dd] = parts
  switch (format) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`
    case 'YYYY-MM-DD': return normalized
    case 'DD Mon YYYY': return `${dd} ${MONTHS[parseInt(mm, 10) - 1] || mm} ${yyyy}`
    default: return normalized
  }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()
}

/** Canonical on-disk base name (no extension) for a track: "NN - Artist - Title". */
export function trackFileBaseName(track: { position: number; artist: string; title: string }): string {
  const pos = String(track.position).padStart(2, '0')
  return `${pos} - ${sanitizeFilename(track.artist)} - ${sanitizeFilename(track.title)}`
}

/**
 * Build an extended-M3U playlist (universal format MP3 players / iPods-via-iTunes
 * understand). fileName entries are relative — the audio is expected to sit
 * alongside the .m3u8 file.
 */
export function buildM3U(
  entries: { duration: number; artist: string; title: string; fileName: string }[]
): string {
  const lines = ['#EXTM3U']
  for (const e of entries) {
    lines.push(`#EXTINF:${Math.round(e.duration) || 0},${e.artist} - ${e.title}`)
    lines.push(e.fileName)
  }
  return lines.join('\n') + '\n'
}
