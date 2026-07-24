import * as RadixToast from '@radix-ui/react-toast'
import type { JSX } from 'react'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button'
import {
  ALERT_CIRCLE_ICON,
  ALERT_TRIANGLE_ICON,
  CHECK_ICON,
  INFO_ICON,
  X_ICON,
} from '@/components/ui/icons'
import {
  resolveDurationMs,
  subscribeToasts,
  type ToastEntry,
  type ToastVariant,
  toast,
} from '@/components/ui/toast'
import { cn } from '@/utils/cn'

const CLOSE_ANIMATION_MS = 200

// Bottom-right toast stack, clamped so it never overflows a narrow viewport.
const VIEWPORT_CLASS =
  'fixed bottom-3 right-3 z-[60] flex flex-col items-end gap-2 ' +
  'w-popup max-w-[calc(100vw-1.5rem)] outline-none m-0 list-none'

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
const VARIANT_ACCENT: Record<ToastVariant, { rail: string; badge: string; icon: JSX.Element }> = {
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

const ANNOUNCE_TYPE: Record<ToastVariant, 'foreground' | 'background'> = {
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
      <RadixToast.Description className="min-w-0 grow break-words pt-1 text-[0.9rem] font-medium leading-snug">
        {entry.message}
      </RadixToast.Description>
      <RadixToast.Close
        aria-label="Dismiss"
        className={cn(ICON_BUTTON_CLASS, 'size-7 shrink-0 rounded-md bg-transparent')}
      >
        {X_ICON}
      </RadixToast.Close>
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
          <ToastItem key={entry.id} entry={entry} />
        ))}
      {/* Portal to <body> so toasts escape #root's stacking context and render above sheet overlays. */}
      {createPortal(<RadixToast.Viewport className={VIEWPORT_CLASS} />, document.body)}
    </RadixToast.Provider>
  )
}
