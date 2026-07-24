import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { BACK_ICON, X_ICON } from '@/components/ui/icons'
import { cn } from '@/utils/cn'

type Side = 'bottom' | 'right' | 'center'

const OVERLAY_CLASS =
  'fixed inset-0 z-40 bg-scrim backdrop-blur-sm data-[state=open]:animate-fade-in'

const CONTENT_BASE_CLASS = 'fixed z-50 flex flex-col border-border-strong bg-surface p-4 pt-3'

const CONTENT_CLASS_BY_SIDE: Record<Side, string> = {
  bottom: cn(
    CONTENT_BASE_CLASS,
    'left-1/2 -translate-x-1/2 bottom-0 w-popup max-h-sheet',
    'rounded-t-xl border-t border-x data-[state=open]:animate-sheet-up',
  ),
  right: cn(
    CONTENT_BASE_CLASS,
    'inset-y-0 right-0 w-drawer max-w-[75vw]',
    'border-l data-[state=open]:animate-sheet-slide-right',
  ),
  center: cn(
    CONTENT_BASE_CLASS,
    // Clamp below viewport width to keep a gutter from the popup edges.
    'left-1/2 top-1/2 [transform:translate(-50%,-50%)] w-popup max-w-[calc(100vw-1.5rem)] max-h-sheet',
    'rounded-xl border data-[state=open]:animate-zoom-in-and-fade',
  ),
}

const SHEET_ICON_BUTTON_CLASS = cn(
  ICON_BUTTON_CLASS,
  'size-8 rounded-md bg-surface text-soft [&_svg]:size-5',
)

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  testId?: string
  onBack?: () => void
  hideClose?: boolean
  // Visually hide the title (kept for screen readers) while leaving the back chevron in place.
  hideTitle?: boolean
  // Extra classes merged onto the title — e.g. to shrink it per-flow.
  titleClassName?: string
  // When set, the header close (X) runs this instead of dismissing the sheet.
  onClose?: () => void
  side?: Side
  children: ReactNode
}

export const Sheet = ({
  open,
  onOpenChange,
  title,
  description,
  testId,
  onBack,
  hideClose = false,
  hideTitle = false,
  titleClassName,
  onClose,
  side = 'bottom',
  children,
}: SheetProps): JSX.Element => (
  <Dialog.Root
    open={open}
    onOpenChange={onOpenChange}
  >
    <Dialog.Portal>
      <Dialog.Overlay className={OVERLAY_CLASS} />
      <Dialog.Content
        data-testid={testId}
        className={CONTENT_CLASS_BY_SIDE[side]}
      >
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 min-w-0">
            {onBack !== undefined && (
              <button
                type="button"
                aria-label="Back"
                onClick={onBack}
                className={SHEET_ICON_BUTTON_CLASS}
              >
                {BACK_ICON}
              </button>
            )}
            <Dialog.Title
              className={cn(
                'm-0 font-display text-lg font-semibold tracking-[-0.02em] leading-tight text-foreground truncate',
                titleClassName,
                hideTitle && 'sr-only',
              )}
            >
              {title}
            </Dialog.Title>
          </div>
          {!hideClose &&
            (onClose !== undefined ? (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className={SHEET_ICON_BUTTON_CLASS}
              >
                {X_ICON}
              </button>
            ) : (
              <Dialog.Close
                aria-label="Close"
                className={SHEET_ICON_BUTTON_CLASS}
              >
                {X_ICON}
              </Dialog.Close>
            ))}
        </div>
        <Dialog.Description className="sr-only">{description}</Dialog.Description>
        {/* -m-1 p-1 gives focus glows room so overflow clipping doesn't shear them. */}
        <div className="-m-1 flex-1 overflow-y-auto p-1">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
)
