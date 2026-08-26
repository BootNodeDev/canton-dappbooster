import { type ReactNode, useEffect, useId, useRef } from 'react'
import { cn } from '@/utils/cn'
import { setTopLayerHost } from '@/utils/topLayer'

interface ModalProps {
  children: ReactNode
  className?: string
  description?: string
  onClose: () => void
  open: boolean
  title: string
}

// Centered dialog over a native `<dialog>`: the top layer carries the scrim, the focus trap, the
// focus restore, the inert background and Escape, so none of it is reimplemented here.
export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps): React.JSX.Element => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) {
      return
    }
    if (!open) {
      if (dialog.open) {
        dialog.close()
      }
      return
    }
    // Only showModal() reaches the top layer; the `open` attribute renders the dialog inline with
    // none of the modal behaviour. Guarded because StrictMode re-runs the effect on mount and a
    // second call on an open dialog throws.
    if (!dialog.open) {
      dialog.showModal()
    }
    // The top layer inerts the page behind but does not stop it scrolling.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTopLayerHost(dialog)
    return () => {
      document.body.style.overflow = previousOverflow
      setTopLayerHost(null)
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description !== undefined ? descId : undefined}
      // `open` stays the one source of truth: without this the UA closes the dialog behind React's
      // back and the prop still says it is open.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Dismissed on press, not click: a text selection released outside the panel reports the
      // dialog as its click target and would close it.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      className="fixed inset-0 h-full max-h-none w-full max-w-none place-items-center bg-transparent p-4 backdrop:bg-[var(--scrim)] backdrop:backdrop-blur-sm open:grid"
    >
      {open && (
        <div
          className={cn(
            'relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-popover)]',
            className,
          )}
        >
          <h2 id={titleId} className="pr-9 text-lg font-bold leading-7 tracking-tight text-fg">
            {title}
          </h2>
          {description !== undefined && (
            <p id={descId} className="mt-1 text-sm text-fg-muted">
              {description}
            </p>
          )}
          <div className="mt-8">{children}</div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-6 top-6 flex h-7 items-center text-fg-muted transition-colors hover:text-fg"
          >
            ✕
          </button>
        </div>
      )}
    </dialog>
  )
}
