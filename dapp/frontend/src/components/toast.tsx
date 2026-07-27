import { useEffect } from 'react'
import { create } from 'zustand'
import { cn } from '@/lib/cn'
import { CheckIcon } from './icons'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  tone: ToastTone
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (tone: ToastTone, message: string) => void
  dismiss: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID().slice(0, 8), tone, message }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string): void => useToastStore.getState().push('success', message),
  error: (message: string): void => useToastStore.getState().push('error', message),
  info: (message: string): void => useToastStore.getState().push('info', message),
}

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent',
}

const ToastRow = ({ item }: { item: ToastItem }): React.JSX.Element => {
  const dismiss = useToastStore((s) => s.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), 3200)
    return () => clearTimeout(timer)
  }, [item.id, dismiss])
  return (
    <button
      type="button"
      onClick={() => dismiss(item.id)}
      className={cn(
        'pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border bg-surface px-4 py-3 text-left text-sm font-semibold shadow-[var(--shadow-popover)]',
        toneStyles[item.tone],
      )}
    >
      {item.tone === 'success' && <CheckIcon width={16} height={16} />}
      <span className="text-fg">{item.message}</span>
    </button>
  )
}

export const Toaster = (): React.JSX.Element => {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-80 flex-col gap-2.5">
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  )
}
