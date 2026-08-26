import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

// A toast carrying an action never times out: the link has to still be there when it is reached for.
interface ToastOptions {
  action?: { label: string; to: string }
  sticky?: boolean
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

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, message, options) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), tone, message, ...options }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

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
