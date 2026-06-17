import { useEffect, useRef, useState, useCallback } from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { AlbumArt } from '../ui/AlbumArt'
import { XMarkIcon, Bars3Icon, TrashIcon } from '@heroicons/react/24/outline'

interface QueueViewProps {
  open: boolean
  onClose: () => void
}

export function QueueView({ open, onClose }: QueueViewProps): JSX.Element | null {
  const queue = usePlayerStore((s) => s.queue)
  const queueIndex = usePlayerStore((s) => s.queueIndex)
  const setQueue = usePlayerStore((s) => s.setQueue)
  const play = usePlayerStore((s) => s.play)
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue)
  const moveInQueue = usePlayerStore((s) => s.moveInQueue)
  const clearUpcoming = usePlayerStore((s) => s.clearUpcoming)
  const panelRef = useRef<HTMLDivElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  const handleDragStart = useCallback((absoluteIndex: number) => {
    setDragIndex(absoluteIndex)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, absoluteIndex: number) => {
    e.preventDefault()
    setDragOverIndex(absoluteIndex)
  }, [])

  const handleDrop = useCallback((absoluteIndex: number) => {
    if (dragIndex !== null && dragIndex !== absoluteIndex) {
      moveInQueue(dragIndex, absoluteIndex)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, moveInQueue])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  if (!open) return null

  const upcoming = queue.slice(queueIndex + 1)
  const upcomingCount = upcoming.length

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full right-0 mb-2 w-80 max-h-96 glass-float glass-border-float overflow-hidden flex flex-col transition-colors duration-200 glass-reveal"
      style={{ borderRadius: 'var(--radius-panel)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border-edge)]">
        <h3 className="text-sm font-semibold">Up Next ({upcomingCount})</h3>
        <div className="flex items-center gap-2">
          {upcomingCount > 0 && (
            <button
              onClick={clearUpcoming}
              className="text-text-muted hover:text-red-400 text-xs flex items-center gap-1 transition"
              title="Clear queue"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xs">
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {upcoming.length === 0 ? (
          <p className="text-sm text-text-muted p-4 text-center">Queue is empty</p>
        ) : (
          upcoming.map((track, i) => {
            const absoluteIndex = queueIndex + 1 + i
            const isDragging = dragIndex === absoluteIndex
            const isDragOver = dragOverIndex === absoluteIndex
            return (
              <div
                key={`${track.id}-${i}`}
                draggable
                onDragStart={() => handleDragStart(absoluteIndex)}
                onDragOver={(e) => handleDragOver(e, absoluteIndex)}
                onDrop={() => handleDrop(absoluteIndex)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 px-4 py-2 transition text-left group ${
                  isDragging ? 'opacity-40' : ''
                } ${isDragOver ? 'bg-accent/10 border-t border-accent/30' : 'hover:bg-glass-hover'}`}
              >
                <span className="text-text-muted cursor-grab active:cursor-grabbing">
                  <Bars3Icon className="w-3.5 h-3.5" />
                </span>
                <button
                  onClick={() => {
                    setQueue(queue, absoluteIndex)
                    play()
                  }}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <span className="text-xs text-text-muted w-5">{i + 1}</span>
                  <AlbumArt src={track.thumbnailUrl} className="w-8 h-8" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{track.title}</p>
                    <p className="text-xs text-text-muted truncate">{track.artist}</p>
                  </div>
                </button>
                <button
                  onClick={() => removeFromQueue(absoluteIndex)}
                  className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1"
                  title="Remove from queue"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
