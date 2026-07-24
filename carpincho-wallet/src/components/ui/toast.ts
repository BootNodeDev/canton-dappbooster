import type { ReactNode } from 'react'

export type ToastVariant = 'info' | 'error' | 'warning' | 'success'

export interface ToastEntry {
  id: string
  variant: ToastVariant
  message: ReactNode
  durationMs: number
}

export interface ToastInput {
  message: ReactNode
  durationMs?: number
}

type Listener = (entries: ReadonlyArray<ToastEntry>) => void

const MAX_VISIBLE = 3

// Only errors persist until dismissed; everything else clears after 5 s.
const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  info: 5000,
  success: 5000,
  warning: 5000,
  error: Number.POSITIVE_INFINITY,
}

export const NEVER_DISMISS_MS = 2_147_483_647

export const resolveDurationMs = (durationMs: number): number =>
  Number.isFinite(durationMs) ? durationMs : NEVER_DISMISS_MS

let entries: ReadonlyArray<ToastEntry> = []
const listeners = new Set<Listener>()

const nextId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`

const notify = (): void => {
  for (const listener of listeners) listener(entries)
}

const emit = (variant: ToastVariant, input: ToastInput | string): string => {
  const normalized: ToastInput = typeof input === 'string' ? { message: input } : input
  const entry: ToastEntry = {
    id: nextId(),
    variant,
    message: normalized.message,
    durationMs: normalized.durationMs ?? DEFAULT_DURATION_MS[variant],
  }
  // Collapse exact duplicates: same variant + identical string message replaces the existing
  // toast (restarting its timer via the fresh id). ReactNode messages are always distinct.
  const isDuplicate = (existing: ToastEntry): boolean =>
    existing.variant === variant &&
    typeof existing.message === 'string' &&
    typeof entry.message === 'string' &&
    existing.message === entry.message
  const withoutDuplicate = entries.filter((existing) => !isDuplicate(existing))
  const next = [...withoutDuplicate, entry]
  entries = next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next
  notify()
  return entry.id
}

const dismiss = (id: string): void => {
  const next = entries.filter((entry) => entry.id !== id)
  if (next.length === entries.length) return
  entries = next
  notify()
}

const clear = (): void => {
  if (entries.length === 0) return
  entries = []
  notify()
}

export const subscribeToasts = (listener: Listener): (() => void) => {
  listeners.add(listener)
  listener(entries)
  return () => {
    listeners.delete(listener)
  }
}

export const getToastEntries = (): ReadonlyArray<ToastEntry> => entries

export const toast = {
  info: (input: ToastInput | string): string => emit('info', input),
  success: (input: ToastInput | string): string => emit('success', input),
  warning: (input: ToastInput | string): string => emit('warning', input),
  error: (input: ToastInput | string): string => emit('error', input),
  dismiss,
  clear,
}
