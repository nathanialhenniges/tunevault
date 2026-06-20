import { useToastStore, type ToastType } from '../../store/toastStore'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

const iconMap: Record<ToastType, JSX.Element> = {
  success: <CheckCircleIcon className="w-4 h-4 text-green-400 shrink-0" />,
  error: <ExclamationCircleIcon className="w-4 h-4 text-red-400 shrink-0" />,
  info: <InformationCircleIcon className="w-4 h-4 text-accent shrink-0" />
}

export function ToastContainer(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return <></>

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm glass-modal glass-border-float shadow-lg animate-slide-up"
          style={{ maxWidth: 360 }}
        >
          {iconMap[t.type]}
          {/* Wrap (don't truncate) so a full error message stays readable. */}
          <span className="flex-1 min-w-0 break-words line-clamp-3">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-text-muted hover:text-text-primary transition shrink-0">
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
