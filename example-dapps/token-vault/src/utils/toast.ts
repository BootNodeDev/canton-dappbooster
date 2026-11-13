import { createToaster, type ToastOptions } from '@ark-ui/react/toast'

export type ToastTone = 'success' | 'error' | 'info'

const AUTO_DISMISS_MS = 3200

const PLACEMENT = 'bottom-end'

export const toaster = createToaster({ placement: PLACEMENT, duration: AUTO_DISMISS_MS, gap: 10 })

export const toastRegion = (): Element | null => document.getElementById(`toast-group:${PLACEMENT}`)

const push = (tone: ToastTone, message: string): void => {
  toaster.create({
    type: tone,
    title: message,
    ...(tone === 'error' && { duration: Number.POSITIVE_INFINITY }),
  })
}

export const toast = {
  success: (message: string): void => push('success', message),
  error: (message: string): void => push('error', message),
  info: (message: string): void => push('info', message),
}

export const readToast = (toast: ToastOptions): { message: string; tone: ToastTone } => ({
  message: String(toast.title),
  tone: (toast.type ?? 'info') as ToastTone,
})
