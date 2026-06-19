import { useCallback, useRef, useState, type DragEvent } from 'react'
import { toast } from '../store/toastStore'
import { useLibraryStore } from '../store/libraryStore'
import { usePlaylistStore } from '../store/playlistStore'

interface ImportDrop {
  isDragging: boolean
  dropHandlers: {
    onDragOver: (e: DragEvent<HTMLElement>) => void
    onDragEnter: (e: DragEvent<HTMLElement>) => void
    onDragLeave: (e: DragEvent<HTMLElement>) => void
    onDrop: (e: DragEvent<HTMLElement>) => void
  }
}

/**
 * Drag-and-drop import. Returns handlers to spread onto the element that should
 * accept drops (scoped there, not app-wide) plus a flag to render an overlay.
 * Dropped audio files/folders import into the library; a dropped playlist URL
 * kicks off a fetch.
 */
export function useImportDrop(): ImportDrop {
  const [isDragging, setIsDragging] = useState(false)
  const counter = useRef(0)

  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => e.preventDefault(), [])

  const onDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    counter.current++
    if (counter.current === 1) setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => {
    counter.current--
    if (counter.current === 0) setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    counter.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) {
      const paths = files.map((f) => window.api.pathForFile(f)).filter(Boolean)
      if (paths.length) {
        window.api
          .importPaths(paths)
          .then((r) => {
            if (r.imported > 0) {
              useLibraryStore.getState().load()
              toast.success(`Imported ${r.imported} tracks into ${r.playlists} playlist(s)`)
            } else {
              toast.error('No audio files found to import')
            }
          })
          .catch((err) => toast.error((err as Error).message))
        return
      }
    }

    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (text && /[?&]list=/.test(text)) {
      const url = text.trim().split('\n')[0]
      usePlaylistStore.getState().setPendingUrl(url)
      usePlaylistStore.getState().fetchPlaylist(url)
    }
  }, [])

  return { isDragging, dropHandlers: { onDragOver, onDragEnter, onDragLeave, onDrop } }
}
