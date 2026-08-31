import { useCopyToClipboard } from '@bootnodedev/canton-dappbooster'
import { Link } from 'react-router-dom'
import { CheckIcon, CopyIcon } from '@/icons'
import { cn } from '@/utils/cn'
import { type ToastItem, type ToastTone, useToastStore } from '@/utils/toast'

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent-strong',
}

export const ToastRow = ({ item }: { item: ToastItem }): React.JSX.Element => {
  const dismiss = useToastStore((s) => s.dismiss)
  const { copy, state } = useCopyToClipboard()
  // A ledger rejection arrives as a wall of text, so only that tone is worth scrolling and copying.
  const isError = item.tone === 'error'
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border bg-surface px-4 py-3 text-left text-sm font-semibold shadow-[var(--shadow-popover)]',
        toneStyles[item.tone],
      )}
    >
      {item.tone === 'success' && <CheckIcon width={16} height={16} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1 text-fg">
        <p className={cn('break-words', isError && 'max-h-40 overflow-y-auto')}>{item.message}</p>
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
      <div className="flex shrink-0 items-center gap-2">
        {isError && (
          <button
            type="button"
            aria-label={state === 'copied' ? 'Error copied' : 'Copy error'}
            onClick={() => void copy(item.message)}
            className="text-fg-muted transition-colors hover:text-fg"
          >
            {state === 'copied' ? (
              <CheckIcon width={16} height={16} />
            ) : (
              <CopyIcon width={16} height={16} />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => dismiss(item.id)}
          className="grid size-6 place-items-center text-fg-muted transition-colors hover:text-fg"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
