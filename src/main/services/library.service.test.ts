import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { LibraryData, Playlist, Track } from '../../shared/models'

// LibraryService reads its userData dir from electron's `app`. Point it at a
// throwaway temp dir per test so the real mutations run against disk.
const h = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: (): string => h.dir } }))

function track(id: string, position: number, extra: Partial<Track> = {}): Track {
  return {
    id,
    videoId: id,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    duration: 100,
    thumbnailUrl: '',
    playlistId: extra.playlistId ?? 'pl1',
    playlistTitle: 'PL',
    position,
    ...extra
  }
}

function playlist(id: string, title: string, tracks: Track[]): Playlist {
  return { id, title, channelTitle: 'ch', thumbnailUrl: '', tracks, fetchedAt: '2026-01-01T00:00:00Z' }
}

function seed(data: LibraryData): void {
  writeFileSync(join(h.dir, 'library.json'), JSON.stringify(data), 'utf-8')
}

// Fresh module per test so the class-static cache/writeQueue don't leak between tests.
async function freshClass(): Promise<typeof import('./library.service').LibraryService> {
  vi.resetModules()
  const mod = await import('./library.service')
  return mod.LibraryService
}

beforeEach(() => {
  h.dir = mkdtempSync(join(tmpdir(), 'tv-lib-'))
})
afterEach(() => {
  rmSync(h.dir, { recursive: true, force: true })
})

describe('LibraryService.deleteTracks', () => {
  it('removes tracks by id and prunes playlists left empty', async () => {
    const LS = await freshClass()
    seed({
      version: 1,
      playlists: [
        playlist('pl1', 'One', [track('a', 1), track('b', 2)]),
        playlist('pl2', 'Two', [track('c', 1, { playlistId: 'pl2' })])
      ]
    })
    const svc = new LS()
    svc.deleteTracks(['a', 'c'])
    const out = svc.load()
    expect(out.playlists.map((p) => p.id)).toEqual(['pl1'])
    expect(out.playlists[0].tracks.map((t) => t.id)).toEqual(['b'])
  })
})

describe('LibraryService.moveTracks', () => {
  it('relocates tracks to the target, repositions them, and prunes the empty source', async () => {
    const LS = await freshClass()
    seed({
      version: 1,
      playlists: [
        playlist('src', 'Src', [track('a', 1), track('b', 2)]),
        playlist('dst', 'Dst', [track('z', 1, { playlistId: 'dst' })])
      ]
    })
    const svc = new LS()
    svc.moveTracks(['a', 'b'], 'dst')
    const out = svc.load()
    expect(out.playlists.map((p) => p.id)).toEqual(['dst'])
    const dst = out.playlists[0]
    expect(dst.tracks.map((t) => t.id).sort()).toEqual(['a', 'b', 'z'])
    const a = dst.tracks.find((t) => t.id === 'a')!
    expect(a.playlistId).toBe('dst')
    expect(a.position).toBeGreaterThan(1) // repositioned after the existing 'z'
  })

  it('throws when the target playlist does not exist', async () => {
    const LS = await freshClass()
    seed({ version: 1, playlists: [playlist('pl1', 'One', [track('a', 1)])] })
    const svc = new LS()
    expect(() => svc.moveTracks(['a'], 'nope')).toThrow(/Target playlist/)
  })
})

describe('LibraryService.setTrackMetadata', () => {
  it('patches only the provided fields and returns the changed tracks', async () => {
    const LS = await freshClass()
    seed({ version: 1, playlists: [playlist('pl1', 'One', [track('a', 1), track('b', 2)])] })
    const svc = new LS()
    const updated = svc.setTrackMetadata(['a'], { genre: 'Rock' })
    expect(updated.map((t) => t.id)).toEqual(['a'])
    const out = svc.load()
    const a = out.playlists[0].tracks.find((t) => t.id === 'a')!
    const b = out.playlists[0].tracks.find((t) => t.id === 'b')!
    expect(a.genre).toBe('Rock')
    expect(a.title).toBe('Title a') // untouched
    expect(b.genre).toBeUndefined()
  })
})

describe('LibraryService.verify', () => {
  it('drops tracks whose files are missing and prunes empty playlists', async () => {
    const LS = await freshClass()
    const realFile = join(h.dir, 'real.mp3')
    writeFileSync(realFile, 'x')
    seed({
      version: 1,
      playlists: [
        playlist('pl1', 'One', [
          track('a', 1, { filePath: realFile }),
          track('b', 2, { filePath: join(h.dir, 'missing.mp3') })
        ]),
        playlist('pl2', 'Two', [track('c', 1, { playlistId: 'pl2', filePath: join(h.dir, 'gone.mp3') })])
      ]
    })
    const svc = new LS()
    const out = svc.verify()
    expect(out.playlists.map((p) => p.id)).toEqual(['pl1'])
    expect(out.playlists[0].tracks.map((t) => t.id)).toEqual(['a'])
  })
})

describe('LibraryService queued writes are awaitable', () => {
  it('applyTrackPatches resolves once the patch is persisted', async () => {
    const LS = await freshClass()
    seed({ version: 1, playlists: [playlist('pl1', 'One', [track('a', 1)])] })
    const svc = new LS()
    // The returned promise must resolve only after the write lands, so callers
    // (e.g. the import handler before writePlaylistInfo) can rely on awaiting it.
    await svc.applyTrackPatches([{ trackId: 'a', genre: 'Jazz', thumbnailUrl: 'tunevault://x' }])
    const a = svc.load().playlists[0].tracks[0]
    expect(a.genre).toBe('Jazz')
    expect(a.thumbnailUrl).toBe('tunevault://x')
  })

  it('addTracks resolves with the new playlist present (regression: import wrote stale/no info)', async () => {
    const LS = await freshClass()
    seed({ version: 1, playlists: [] })
    const svc = new LS()
    const pl = playlist('imported:Mix', 'Mix', [])
    await svc.addTracks(pl, [track('x', 1, { playlistId: 'imported:Mix' })])
    // Immediately after the await, the playlist must be readable — this is what
    // writePlaylistInfo() depends on right after addTracks in the import handler.
    const out = svc.load()
    expect(out.playlists.map((p) => p.id)).toEqual(['imported:Mix'])
    expect(out.playlists[0].tracks.map((t) => t.id)).toEqual(['x'])
  })
})
