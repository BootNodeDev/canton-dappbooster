import { Dialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { toastRegion } from '@/utils/toast'

interface ModalProps {
  children: ReactNode
  onClose: () => void
  title: string
}

export const Modal = ({ onClose, title, children }: ModalProps): React.JSX.Element => (
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
        <Dialog.Content className="relative w-full max-w-md overflow-x-clip rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-popover)]">
          <Dialog.Title className="pr-14 text-lg font-bold leading-7 tracking-tight text-fg">
            {title}
          </Dialog.Title>
          <div className="mt-4">{children}</div>
          <Dialog.CloseTrigger
            aria-label="Close"
            className="absolute right-6 top-6 grid size-7 place-items-center text-fg-muted transition-colors hover:text-fg"
          >
            <X size={16} />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
)
