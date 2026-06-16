import { create } from 'zustand'
import type { LibraryData, Track } from '../../../shared/models'
import { toast } from './toastStore'

export type SortField = 'title' | 'artist' | 'duration' | 'dateAdded' | 'playlist'
export type SortDirection = 'asc' | 'desc'

const SORT_KEY = 'tunevault:library-sort'

function loadSortPreference(): { sortBy: SortField; sortDirection: SortDirection } {
  try {
    const raw = localStorage.getItem(SORT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { sortBy: parsed.sortBy ?? 'title', sortDirection: parsed.sortDirection ?? 'asc' }
    }
  } catch { /* ignore */ }
  return { sortBy: 'title', sortDirection: 'asc' }
}

function saveSortPreference(sortBy: SortField, sortDirection: SortDirection): void {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify({ sortBy, sortDirection }))
  } catch { /* ignore */ }
}

interface LibraryState {
  library: LibraryData
  loaded: boolean
  searchQuery: string
  selectedTrackIds: Set<string>
  sortBy: SortField
  sortDirection: SortDirection
  load: () => Promise<void>
  setSearchQuery: (query: string) => void
  setSortBy: (field: SortField) => void
  toggleSortDirection: () => void
  getAllTracks: () => Track[]
  getFilteredTracks: () => Track[]
  getPlaylistTracks: (playlistId: string) => Track[]
  lastSelectedIndex: number | null
  toggleTrackSelection: (trackId: string, index?: number) => void
  shiftSelectTracks: (currentIndex: number, tracks: Track[]) => void
  selectAllTracks: () => void
  clearSelection: () => void
  deleteTracks: (trackIds: string[]) => Promise<void>
  deleteAll: () => Promise<void>
  openFolder: (filePath: string) => Promise<void>
}

const initialSort = loadSortPreference()

export const useLibraryStore = create<LibraryState>((set, get) => ({
  library: { playlists: [], version: 1 },
  loaded: false,
  searchQuery: '',
  selectedTrackIds: new Set(),
  sortBy: initialSort.sortBy,
  sortDirection: initialSort.sortDirection,
  lastSelectedIndex: null,

  load: async () => {
    // Verify checks files on disk and removes missing tracks
    const library = await window.api.verifyLibrary()
    set({ library, loaded: true, selectedTrackIds: new Set() })
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSortBy: (field) => {
    const { sortBy, sortDirection } = get()
    let newSortBy: SortField
    let newDirection: SortDirection
    if (sortBy === field) {
      newSortBy = field
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      newSortBy = field
      newDirection = 'asc'
    }
    set({ sortBy: newSortBy, sortDirection: newDirection })
    saveSortPreference(newSortBy, newDirection)
  },

  toggleSortDirection: () => {
    const { sortBy, sortDirection } = get()
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    set({ sortDirection: newDirection })
    saveSortPreference(sortBy, newDirection)
  },

  getAllTracks: () => {
    const { library } = get()
    return library.playlists.flatMap((p) =>
      p.tracks.filter((t) => t.filePath)
    )
  },

  getFilteredTracks: () => {
    const { searchQuery, sortBy, sortDirection } = get()
    let tracks = get().getAllTracks()
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      tracks = tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.playlistTitle.toLowerCase().includes(q)
      )
    }

    const dir = sortDirection === 'asc' ? 1 : -1
    tracks.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return dir * a.title.localeCompare(b.title)
        case 'artist':
          return dir * a.artist.localeCompare(b.artist)
        case 'duration':
          return dir * (a.duration - b.duration)
        case 'dateAdded':
          return dir * ((a.downloadedAt ?? '').localeCompare(b.downloadedAt ?? ''))
        case 'playlist':
          return dir * a.playlistTitle.localeCompare(b.playlistTitle)
        default:
          return 0
      }
    })

    return tracks
  },

  getPlaylistTracks: (playlistId: string) => {
    const { library } = get()
    const playlist = library.playlists.find((p) => p.id === playlistId)
    return playlist?.tracks.filter((t) => t.filePath) ?? []
  },

  toggleTrackSelection: (trackId: string, index?: number) => {
    const { selectedTrackIds } = get()
    const newSet = new Set(selectedTrackIds)
    if (newSet.has(trackId)) {
      newSet.delete(trackId)
    } else {
      newSet.add(trackId)
    }
    set({ selectedTrackIds: newSet, lastSelectedIndex: index ?? null })
  },

  shiftSelectTracks: (currentIndex: number, tracks: Track[]) => {
    const { lastSelectedIndex, selectedTrackIds } = get()
    if (lastSelectedIndex === null) {
      // No previous selection — just select this one
      const newSet = new Set(selectedTrackIds)
      newSet.add(tracks[currentIndex].id)
      set({ selectedTrackIds: newSet, lastSelectedIndex: currentIndex })
      return
    }
    const start = Math.min(lastSelectedIndex, currentIndex)
    const end = Math.max(lastSelectedIndex, currentIndex)
    const newSet = new Set(selectedTrackIds)
    for (let i = start; i <= end; i++) {
      newSet.add(tracks[i].id)
    }
    set({ selectedTrackIds: newSet, lastSelectedIndex: currentIndex })
  },

  selectAllTracks: () => {
    const tracks = get().getFilteredTracks()
    set({ selectedTrackIds: new Set(tracks.map((t) => t.id)) })
  },

  clearSelection: () => {
    set({ selectedTrackIds: new Set() })
  },

  deleteTracks: async (trackIds: string[]) => {
    await window.api.deleteTracks(trackIds)
    toast.success(`Deleted ${trackIds.length} track${trackIds.length === 1 ? '' : 's'}`)
    await get().load()
  },

  deleteAll: async () => {
    await window.api.deleteAllLibrary()
    toast.success('Library cleared')
    await get().load()
  },

  openFolder: async (filePath: string) => {
    await window.api.openFolder(filePath)
  }
}))
