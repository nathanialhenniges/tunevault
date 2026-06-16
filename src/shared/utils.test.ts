import { describe, it, expect } from 'vitest'
import { formatDate, formatDuration, sanitizeFilename, trackFileBaseName } from './utils'

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

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('')
  })

  it('handles string with only forbidden characters', () => {
    expect(sanitizeFilename('<>:"/\\|?*')).toBe('')
  })

  it('handles tabs and newlines as whitespace', () => {
    expect(sanitizeFilename('hello\t\nworld')).toBe('hello world')
  })
})
