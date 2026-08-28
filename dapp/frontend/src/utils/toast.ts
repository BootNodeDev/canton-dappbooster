import { create } from 'zustand'
import { randomId } from '@/utils/randomId'

export type ToastTone = 'success' | 'error' | 'info'

// A toast carrying an action never times out: the link has to still be there when it is reached for.
interface ToastOptions {
  action?: { label: string; to: string }
}

export interface ToastItem extends ToastOptions {
  id: string
  message: string
  tone: ToastTone
}

interface ToastState {
  dismiss: (id: string) => void
  push: (tone: ToastTone, message: string, options?: ToastOptions) => void
  toasts: ToastItem[]
}

// Counted from the push, not from the row that renders it: the viewport moves between the body and
// an open dialog, and remounting there would hand every toast on screen a fresh full life.
const AUTO_DISMISS_MS = 3200

// Held so a hand-dismissed toast can cancel its own clock. Without this the timer still fires into
// an empty store, and `filter` returning a fresh array notifies every subscriber for a no-op.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set) => {
  const remove = (id: string): void => {
    timers.delete(id)
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  }

  return {
    toasts: [],
    push: (tone, message, options) => {
      const id = randomId()
      set((state) => ({ toasts: [...state.toasts, { id, tone, message, ...options }] }))
      // An error stays until dismissed: it is the only tone whose text the user has to read in full,
      // and often copy, before it is any use.
      if (tone !== 'error' && options?.action === undefined) {
        timers.set(
          id,
          setTimeout(() => remove(id), AUTO_DISMISS_MS),
        )
      }
    },
    dismiss: (id) => {
      const timer = timers.get(id)
      if (timer !== undefined) {
        clearTimeout(timer)
      }
      remove(id)
    },
  }
})

export const toast = {
  success: (message: string, options?: ToastOptions): void =>
    useToastStore.getState().push('success', message, options),
  error: (message: string, options?: ToastOptions): void =>
    useToastStore.getState().push('error', message, options),
  info: (message: string, options?: ToastOptions): void =>
    useToastStore.getState().push('info', message, options),
}

// The Toaster is the app's live region, so kit `<Identifier>`s using this pass `announce={false}`.
export const copyToast =
  (noun: string) =>
  (outcome: { ok: boolean }): void => {
    if (outcome.ok) {
      toast.success(`${noun} copied`)
    } else {
      toast.error(`Could not copy ${noun.toLowerCase()}`)
    }
  }
