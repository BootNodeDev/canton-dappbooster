import { useCallback, useEffect, useRef, useState } from 'react'

/** Transient result of the last copy, for styling an affordance. Returns to `idle` on a timer. */
export type CopyState = 'idle' | 'copied' | 'error'

/** Result of one copy call. A rejected clipboard write is an outcome, not a thrown error. */
export type CopyOutcome = { ok: true; value: string } | { ok: false; error: Error }

/** Overrides for {@link useCopyToClipboard}. Omitted fields fall back to a 1200 ms reset. */
export interface UseCopyToClipboardOptions {
  /** How long `state` stays on `copied`/`error` before returning to `idle`. */
  resetMs?: number
}

/**
 * Return shape of {@link useCopyToClipboard}, held by callers rendering their own copy control.
 * `<Identifier>` consumes it internally.
 */
export interface UseCopyToClipboardResult {
  /** Drives affordance styling. For one-off feedback use `copy`'s outcome instead. */
  state: CopyState
  /** Writes `value` to the clipboard. Never rejects; the outcome is the resolved value. */
  copy: (value: string) => Promise<CopyOutcome>
}

const RESET_MS = 1200

/**
 * Clipboard write with a transient result state. Callers that need their own feedback (a toast,
 * say) use the returned outcome; callers that only need an affordance style off `state`.
 *
 * Reach for this over `<Identifier>` when the copy control must be a sibling of the value rather
 * than a child of it.
 */
export const useCopyToClipboard = (
  options?: UseCopyToClipboardOptions,
): UseCopyToClipboardResult => {
  const resetMs = options?.resetMs ?? RESET_MS
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(
    async (value: string): Promise<CopyOutcome> => {
      // Clearing on settle, not on entry, stops overlapping writes orphaning each other's timer.
      const settle = (next: CopyState): void => {
        clearTimeout(timer.current)
        if (!live.current) return
        setState(next)
        timer.current = setTimeout(() => setState('idle'), resetMs)
      }
      try {
        // Absent outside a secure context; there is no fallback, so report it to the caller.
        const clipboard = globalThis.navigator?.clipboard
        if (clipboard === undefined) {
          throw new Error('Clipboard unavailable')
        }
        await clipboard.writeText(value)
        settle('copied')
        return { ok: true, value }
      } catch (cause) {
        settle('error')
        return { ok: false, error: cause instanceof Error ? cause : new Error('Copy failed') }
      }
    },
    [resetMs],
  )

  return { state, copy }
}
