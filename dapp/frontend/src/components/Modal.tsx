import { type ReactNode, useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

// Lightweight centered dialog: scrim + Escape-to-close + scroll lock.
export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps): React.JSX.Element | null => {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') {
        return
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable === undefined || focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog so Tab is trapped and screen readers land here.
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstFocusable ?? dialogRef.current)?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--scrim,rgba(8,8,18,0.6))] backdrop-blur-sm"
        style={{ background: 'rgba(8,8,18,0.6)' }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-popover)]',
          className,
        )}
      >
        <h2 className="text-lg font-bold tracking-tight text-fg">{title}</h2>
        {description !== undefined && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
