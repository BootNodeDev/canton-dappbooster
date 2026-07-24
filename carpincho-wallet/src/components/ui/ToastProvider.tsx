import * as RadixToast from '@radix-ui/react-toast'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FeedbackVariant } from '@/components/ui/Alert'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button'
import {
  ALERT_CIRCLE_ICON,
  ALERT_TRIANGLE_ICON,
  CHECK_ICON,
  COPY_ICON,
  INFO_ICON,
  X_ICON,
} from '@/components/ui/icons'
import { resolveDurationMs, subscribeToasts, type ToastEntry, toast } from '@/components/ui/toast'
import { copyText } from '@/utils/clipboard'
import { cn } from '@/utils/cn'

const CLOSE_ANIMATION_MS = 200

// Mirror the app shell width so toast cards align with the content column.
const VIEWPORT_CLASS =
  'fixed top-2 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 ' +
  'w-popup px-3 outline-none m-0 list-none'

// Elevated surface card with a variant-tinted left accent rail.
const BASE_TOAST_CLASS = cn(
  'relative flex items-start gap-3 overflow-hidden py-3 pl-4 pr-2.5',
  'rounded-lg border border-border bg-surface text-foreground shadow-popover',
  "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
  'data-[state=open]:animate-slide-down-and-fade data-[state=closed]:animate-slide-up-and-fade-out',
  'data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)]',
  'data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out]',
  'data-[swipe=end]:animate-slide-up-and-fade-out',
)

// Per-variant accent: only the rail and icon badge carry colour; message text stays neutral.
const VARIANT_ACCENT: Record<FeedbackVariant, { rail: string; badge: string; icon: JSX.Element }> =
  {
    info: { rail: 'before:bg-primary', badge: 'bg-primary-soft text-primary', icon: INFO_ICON },
    success: { rail: 'before:bg-success', badge: 'bg-success-soft text-success', icon: CHECK_ICON },
    warning: {
      rail: 'before:bg-warning',
      badge: 'bg-warning-soft text-warning',
      icon: ALERT_TRIANGLE_ICON,
    },
    error: {
      rail: 'before:bg-danger',
      badge: 'bg-danger-soft text-danger',
      icon: ALERT_CIRCLE_ICON,
    },
  }

const ANNOUNCE_TYPE: Record<FeedbackVariant, 'foreground' | 'background'> = {
  info: 'background',
  success: 'background',
  warning: 'foreground',
  error: 'foreground',
}

interface ToastItemProps {
  entry: ToastEntry
}

const ToastItem = ({ entry }: ToastItemProps): JSX.Element => {
  const accent = VARIANT_ACCENT[entry.variant]
  // Copy the rendered text so both string and ReactNode messages copy cleanly.
  const descriptionRef = useRef<HTMLDivElement>(null)
  const copyMessage = (): void => {
    const text = descriptionRef.current?.textContent?.trim() ?? ''
    if (text) copyText(text, 'Message copied')
  }
  return (
    <RadixToast.Root
      duration={resolveDurationMs(entry.durationMs)}
      type={ANNOUNCE_TYPE[entry.variant]}
      onOpenChange={(open) => {
        if (!open) {
          window.setTimeout(() => toast.dismiss(entry.id), CLOSE_ANIMATION_MS)
        }
      }}
      className={cn(BASE_TOAST_CLASS, accent.rail)}
    >
      <span
        aria-hidden="true"
        className={cn('mt-px grid size-7 shrink-0 place-items-center rounded-full', accent.badge)}
      >
        {accent.icon}
      </span>
      <RadixToast.Description
        ref={descriptionRef}
        className="min-w-0 grow max-h-40 overflow-y-auto break-words pt-1 text-[0.9rem] font-medium leading-snug"
      >
        {entry.message}
      </RadixToast.Description>
      <div className="flex shrink-0 items-start gap-0.5">
        {entry.variant === 'error' && (
          <button
            type="button"
            aria-label="Copy message"
            onClick={copyMessage}
            className={cn(ICON_BUTTON_CLASS, 'size-7 shrink-0 rounded-md bg-transparent')}
          >
            {COPY_ICON}
          </button>
        )}
        <RadixToast.Close
          aria-label="Dismiss"
          className={cn(ICON_BUTTON_CLASS, 'size-7 shrink-0 rounded-md bg-transparent')}
        >
          {X_ICON}
        </RadixToast.Close>
      </div>
    </RadixToast.Root>
  )
}

interface ToastProviderProps {
  children: ReactNode
}

export const ToastProvider = ({ children }: ToastProviderProps): JSX.Element => {
  const [entries, setEntries] = useState<ReadonlyArray<ToastEntry>>([])
  useEffect(() => subscribeToasts(setEntries), [])
  return (
    <RadixToast.Provider swipeDirection="up">
      {children}
      {entries
        .slice()
        .reverse()
        .map((entry) => (
          <ToastItem
            key={entry.id}
            entry={entry}
          />
        ))}
      {/* Portal to <body> so toasts escape #root's stacking context and render above sheet overlays. */}
      {createPortal(<RadixToast.Viewport className={VIEWPORT_CLASS} />, document.body)}
    </RadixToast.Provider>
  )
}
