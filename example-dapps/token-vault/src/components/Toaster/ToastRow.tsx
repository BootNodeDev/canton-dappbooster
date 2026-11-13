import { Toast, type ToastOptions } from '@ark-ui/react/toast'
import { Check, X } from 'lucide-react'
import { CopyButton } from '@/components/CopyButton'
import { cn } from '@/utils/cn'
import { readToast, type ToastTone } from '@/utils/toast'

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent-strong',
}

export const ToastRow = ({ toast }: { toast: ToastOptions }): React.JSX.Element => {
  const { message, tone } = readToast(toast)
  const isError = tone === 'error'

  return (
    <Toast.Root
      className={cn(
        'flex w-80 items-start gap-2.5 rounded-xl border bg-surface px-4 py-3 text-left text-sm font-semibold shadow-[var(--shadow-popover)]',
        toneStyles[tone],
      )}
    >
      {tone === 'success' && <Check size={16} className="mt-0.5 shrink-0" />}
      <Toast.Title
        className={cn('min-w-0 flex-1 break-words text-fg', isError && 'max-h-40 overflow-y-auto')}
      >
        {message}
      </Toast.Title>
      <div className="flex shrink-0 items-center gap-2">
        {isError && <CopyButton className="text-fg-muted" label="Error" value={message} />}
        <Toast.CloseTrigger className="grid size-6 place-items-center text-fg-muted transition-colors hover:text-fg">
          <X size={14} />
        </Toast.CloseTrigger>
      </div>
    </Toast.Root>
  )
}
