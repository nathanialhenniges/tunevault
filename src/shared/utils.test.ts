import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDuration,
  sanitizeFilename,
  trackFileBaseName,
  buildM3U,
  isRateLimitMessage
} from './utils'

describe('isRateLimitMessage', () => {
  it('detects the propagated RATE_LIMITED marker and raw 429s', () => {
    expect(isRateLimitMessage('RATE_LIMITED')).toBe(true)
    expect(isRateLimitMessage('HTTP Error 429: Too Many Requests')).toBe(true)
  })

  it('detects rate-limit phrasing case-insensitively', () => {
    expect(isRateLimitMessage('ERROR: Too Many Requests')).toBe(true)
    expect(isRateLimitMessage('you hit the rate limit')).toBe(true)
  })

  it('does not flag ordinary errors', () => {
    expect(isRateLimitMessage('yt-dlp exited with code 1')).toBe(false)
    expect(isRateLimitMessage('Video unavailable')).toBe(false)
  })
})

describe('buildM3U', () => {
  it('emits extended M3U with rounded durations and relative filenames', () => {
    const out = buildM3U([
      { duration: 180.7, artist: 'A', title: 'Song', fileName: '01 - A - Song.mp3' },
      { duration: 0, artist: 'B', title: 'Two', fileName: '02 - B - Two.mp3' }
    ])
    expect(out).toBe(
      '#EXTM3U\n' +
        '#EXTINF:181,A - Song\n01 - A - Song.mp3\n' +
        '#EXTINF:0,B - Two\n02 - B - Two.mp3\n'
    )
  })
})

describe('trackFileBaseName', () => {
  it('pads position and sanitizes artist/title', () => {
    expect(trackFileBaseName({ position: 3, artist: 'A/C: DC', title: 'T*N?' })).toBe(
      '03 - AC DC - TN'
    )
  })

  it('keeps two-digit positions intact', () => {
    expect(trackFileBaseName({ position: 12, artist: 'Foo', title: 'Bar' })).toBe('12 - Foo - Bar')
  })
})

describe('formatDate', () => {
  it('formats YYYYMMDD to MM/DD/YYYY', () => {
    expect(formatDate('20230415', 'MM/DD/YYYY')).toBe('04/15/2023')
  })

  it('formats YYYYMMDD to DD/MM/YYYY', () => {
    expect(formatDate('20230415', 'DD/MM/YYYY')).toBe('15/04/2023')
  })

  it('formats YYYYMMDD to YYYY-MM-DD', () => {
    expect(formatDate('20230415', 'YYYY-MM-DD')).toBe('2023-04-15')
  })

  it('formats YYYYMMDD to DD Mon YYYY', () => {
    expect(formatDate('20230415', 'DD Mon YYYY')).toBe('15 Apr 2023')
  })

  it('handles already-formatted YYYY-MM-DD input', () => {
    expect(formatDate('2023-04-15', 'MM/DD/YYYY')).toBe('04/15/2023')
  })

  it('returns raw string if fewer than 3 date parts', () => {
    expect(formatDate('2023-04', 'MM/DD/YYYY')).toBe('2023-04')
  })

  it('handles January (month index 0)', () => {
    expect(formatDate('20230101', 'DD Mon YYYY')).toBe('01 Jan 2023')
  })

  it('handles December (month index 11)', () => {
    expect(formatDate('20231231', 'DD Mon YYYY')).toBe('31 Dec 2023')
  })

  it('returns the raw value for input that is not date-like', () => {
    expect(formatDate('garbage', 'MM/DD/YYYY')).toBe('garbage')
  })

  it('does not throw on an 8-char string with a non-numeric month', () => {
    // 'DD Mon YYYY' looks up MONTHS[NaN] -> undefined and falls back to the raw month.
    expect(formatDate('2023XX15', 'DD Mon YYYY')).toBe('15 XX 2023')
  })
})

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('0:45')
  })

  it('pads single-digit seconds', () => {
    expect(formatDuration(63)).toBe('1:03')
  })

  it('formats exact minutes', () => {
    expect(formatDuration(120)).toBe('2:00')
  })

  it('formats long durations', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })
})

describe('sanitizeFilename', () => {
  it('removes forbidden characters', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('abcdefghij')
  })

  it('collapses multiple spaces to single space', () => {
    expect(sanitizeFilename('hello   world')).toBe('hello world')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilename('  hello  ')).toBe('hello')
  })

  it('handles a clean filename unchanged', () => {
    expect(sanitizeFilename('My Song - Artist')).toBe('My Song - Artist')
  })

  it('falls back to "untitled" for an empty string', () => {
    expect(sanitizeFilename('')).toBe('untitled')
  })

  it('falls back to "untitled" when only forbidden characters', () => {
    expect(sanitizeFilename('<>:"/\\|?*')).toBe('untitled')
  })

  it('handles tabs and newlines as whitespace', () => {
    expect(sanitizeFilename('hello\t\nworld')).toBe('hello world')
  })

  // Path-traversal protection: a sanitized name must never be able to escape or
  // hide the folder it is joined into.
  it('neutralizes ".." so it cannot traverse up a directory', () => {
    expect(sanitizeFilename('..')).toBe('untitled')
  })

  it('neutralizes "." ', () => {
    expect(sanitizeFilename('.')).toBe('untitled')
  })

  it('strips leading dots so the result is never a hidden/relative entry', () => {
    expect(sanitizeFilename('...evil')).toBe('evil')
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd')
  })
})
