import { create } from 'zustand'
import { toast } from './toastStore'
import { useLibraryStore } from './libraryStore'
import type { ImportConflictDecision } from '../../../shared/models'

interface ImportState {
  /** Set while waiting for the user to resolve a duplicate-file prompt. */
  conflict: { names: string[] } | null
  /** Internal: resolves the in-flight prompt promise. */
  decide: ((d: ImportConflictDecision | null) => void) | null
  /** Run an import; transparently prompts + retries when dupes are found. */
  run: (paths: string[]) => Promise<void>
  /** Called by the modal with the user's choice (null = cancel). */
  resolve: (d: ImportConflictDecision | null) => void
}

export const useImportStore = create<ImportState>((set, get) => ({
  conflict: null,
  decide: null,
  run: async (paths) => {
    try {
      let r = await window.api.importPaths(paths)
      if (r.needsDecision) {
        const decision = await new Promise<ImportConflictDecision | null>((res) => {
          set({ conflict: { names: r.conflicts ?? [] }, decide: res })
        })
        set({ conflict: null, decide: null })
        if (!decision) return // cancelled — import nothing
        r = await window.api.importPaths(paths, decision)
      }
      if (r.imported > 0) {
        useLibraryStore.getState().load()
        toast.success(
          `Imported ${r.imported} track${r.imported === 1 ? '' : 's'} into ${r.playlists} playlist${r.playlists === 1 ? '' : 's'}`
        )
      } else {
        toast.info('Nothing new to import')
      }
    } catch (e) {
      set({ conflict: null, decide: null })
      toast.error((e as Error).message)
    }
  },
  resolve: (d) => {
    get().decide?.(d)
  }
}))
