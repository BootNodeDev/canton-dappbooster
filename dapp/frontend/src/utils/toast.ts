import { createToaster, type ToastOptions } from '@ark-ui/react/toast'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  to: string
}

export interface ToastMeta {
  action?: ToastAction
}

const AUTO_DISMISS_MS = 3200

const PLACEMENT = 'bottom-end'

export const toaster = createToaster({ placement: PLACEMENT, duration: AUTO_DISMISS_MS, gap: 10 })

export const toastRegion = (): Element | null => document.getElementById(`toast-group:${PLACEMENT}`)

const push = (tone: ToastTone, message: string, meta?: ToastMeta): void => {
  toaster.create({
    type: tone,
    title: message,
    meta,
    ...(tone === 'error' && { duration: Number.POSITIVE_INFINITY }),
  })
}

export const toast = {
  success: (message: string, meta?: ToastMeta): void => push('success', message, meta),
  error: (message: string, meta?: ToastMeta): void => push('error', message, meta),
  info: (message: string, meta?: ToastMeta): void => push('info', message, meta),
}

export const readToast = (
  toast: ToastOptions,
): { action?: ToastAction; message: string; tone: ToastTone } => ({
  ...(toast.meta as ToastMeta | undefined),
  message: String(toast.title),
  tone: (toast.type ?? 'info') as ToastTone,
})
