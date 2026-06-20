import { useImportStore } from '../../store/importStore'
import { Modal } from './Modal'
import { Button } from './Button'

/**
 * Prompt shown when dropped files already exist in the library (matched by
 * content hash). Mounted once at the app root; driven entirely by importStore.
 */
export function ImportConflictModal(): JSX.Element | null {
  const conflict = useImportStore((s) => s.conflict)
  const resolve = useImportStore((s) => s.resolve)
  if (!conflict) return null

  const n = conflict.names.length
  const preview = conflict.names.slice(0, 5)

  return (
    <Modal open onClose={() => resolve(null)} className="p-6 max-w-md mx-4">
      <h3 className="text-lg font-semibold mb-2">
        {n} duplicate file{n === 1 ? '' : 's'}
      </h3>
      <p className="text-sm text-text-secondary mb-3">
        {n === 1 ? 'This file is' : 'These files are'} already in your library. What should happen?
      </p>
      <ul className="text-xs text-text-muted mb-5 space-y-0.5 max-h-32 overflow-y-auto">
        {preview.map((name) => (
          <li key={name} className="truncate">
            {name}
          </li>
        ))}
        {n > preview.length && <li>and {n - preview.length} more…</li>}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => resolve(null)}>
          Cancel
        </Button>
        <Button variant="secondary" size="sm" onClick={() => resolve('skip')}>
          Skip duplicates
        </Button>
        <Button variant="secondary" size="sm" onClick={() => resolve('keep')}>
          Keep both
        </Button>
        <Button variant="primary" size="sm" onClick={() => resolve('overwrite')}>
          Replace
        </Button>
      </div>
    </Modal>
  )
}
