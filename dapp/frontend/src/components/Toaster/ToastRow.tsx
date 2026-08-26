import { Link } from 'react-router-dom'
import { CheckIcon } from '@/icons'
import { cn } from '@/utils/cn'
import { type ToastItem, type ToastTone, useToastStore } from '@/utils/toast'

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent-strong',
}

export const ToastRow = ({ item }: { item: ToastItem }): React.JSX.Element => {
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border bg-surface px-4 py-3 text-left text-sm font-semibold shadow-[var(--shadow-popover)]',
        toneStyles[item.tone],
      )}
    >
      {item.tone === 'success' && <CheckIcon width={16} height={16} className="mt-0.5 shrink-0" />}
      <div className="flex-1 text-fg">
        {item.message}
        {item.action !== undefined && (
          <Link
            to={item.action.to}
            onClick={() => dismiss(item.id)}
            className="mt-1 block text-xs font-bold text-primary-strong hover:underline"
          >
            {item.action.label}
          </Link>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(item.id)}
        className="grid size-6 shrink-0 place-items-center text-fg-muted transition-colors hover:text-fg"
      >
        ✕
      </button>
    </div>
  )
}
