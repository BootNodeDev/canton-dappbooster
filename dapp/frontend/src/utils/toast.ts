import { createToaster, type ToastOptions } from '@ark-ui/react/toast'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  to: string
}

// A toast carrying an action never times out: the link has to still be there when it is reached for.
export interface ToastMeta {
  action?: ToastAction
}

const AUTO_DISMISS_MS = 3200

const PLACEMENT = 'bottom-end'

export const toaster = createToaster({ placement: PLACEMENT, duration: AUTO_DISMISS_MS, gap: 10 })

// A modal dialog treats every click outside its own content as a dismissal and blocks the pointer
// there, so it has to be told the toast region is not "outside": a failed submit raises one over it.
export const toastRegion = (): Element | null => document.getElementById(`toast-group:${PLACEMENT}`)

// An error stays until dismissed: it is the only tone whose text the user has to read in full, and
// often copy, before it is any use.
const push = (tone: ToastTone, message: string, meta?: ToastMeta): void => {
  const persist = tone === 'error' || meta?.action !== undefined
  toaster.create({
    type: tone,
    title: message,
    meta,
    ...(persist && { duration: Number.POSITIVE_INFINITY }),
  })
}

export const toast = {
  success: (message: string, meta?: ToastMeta): void => push('success', message, meta),
  error: (message: string, meta?: ToastMeta): void => push('error', message, meta),
  info: (message: string, meta?: ToastMeta): void => push('info', message, meta),
}

// Ark types a toast loosely — any meta, a ReactNode title — so the shape `push` actually writes is
// read back here rather than narrowed again in the view.
export const readToast = (
  toast: ToastOptions,
): { action?: ToastAction; message: string; tone: ToastTone } => ({
  ...(toast.meta as ToastMeta | undefined),
  message: String(toast.title),
  tone: (toast.type ?? 'info') as ToastTone,
})

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
