import { Dialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { toastRegion } from '@/utils/toast'

interface ModalProps {
  children: ReactNode
  className?: string
  description?: string
  onClose: () => void
  title: string
}

export const Modal = ({
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps): React.JSX.Element => (
  <Dialog.Root
    open
    onOpenChange={(details) => {
      if (!details.open) {
        onClose()
      }
    }}
    persistentElements={[toastRegion]}
    onFocusOutside={(event) => event.preventDefault()}
  >
    <Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-sm" />
      <Dialog.Positioner className="fixed inset-0 z-50 grid place-items-center p-4">
        <Dialog.Content
          className={cn(
            'relative w-full max-w-md overflow-x-clip rounded-[calc(var(--radius-card)+4px)] border border-border bg-surface p-6 shadow-[var(--shadow-popover)] sm:p-7',
            className,
          )}
        >
          <Dialog.Title className="pr-14 font-heading text-xl leading-7 font-extrabold text-fg">
            {title}
          </Dialog.Title>
          {description !== undefined && (
            <Dialog.Description className="mt-1 text-sm text-fg-muted">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
          <Dialog.CloseTrigger
            aria-label="Close"
            className="absolute top-6 right-6 grid size-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-muted hover:text-fg sm:top-7 sm:right-7"
          >
            <X size={16} />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
)
