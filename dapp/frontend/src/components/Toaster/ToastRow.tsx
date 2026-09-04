import { Toast, type ToastOptions, useToastContext } from '@ark-ui/react/toast'
import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CopyButton } from '@/components/CopyButton'
import { cn } from '@/utils/cn'
import { readToast, type ToastTone } from '@/utils/toast'

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent-strong',
}

export const ToastRow = ({ toast }: { toast: ToastOptions }): React.JSX.Element => {
  const { dismiss } = useToastContext()
  const { action, message, tone } = readToast(toast)
  const isError = tone === 'error'

  return (
    <Toast.Root
      className={cn(
        'flex w-80 items-start gap-2.5 rounded-xl border bg-surface px-4 py-3 text-left text-sm font-semibold shadow-[var(--shadow-popover)]',
        toneStyles[tone],
      )}
    >
      {tone === 'success' && <Check size={16} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1 text-fg">
        <Toast.Title className={cn('break-words', isError && 'max-h-40 overflow-y-auto')}>
          {message}
        </Toast.Title>
        {action !== undefined && (
          <Link
            to={action.to}
            onClick={dismiss}
            className="mt-1 block text-xs font-bold text-primary-strong hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isError && <CopyButton className="text-fg-muted" label="Error" value={message} />}
        <Toast.CloseTrigger className="grid size-6 place-items-center text-fg-muted transition-colors hover:text-fg">
          <X size={14} />
        </Toast.CloseTrigger>
      </div>
    </Toast.Root>
  )
}
