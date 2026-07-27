import { useSyncExternalStore } from 'react'

// A single shared clock so every vested/claimable figure recomputes in lockstep.
// Ticks once a second; that is plenty for linear accrual on a dashboard. Swapping
// in a ledger-time source later means changing only this module.

let nowMs = Date.now()
const listeners = new Set<() => void>()

const tick = (): void => {
  nowMs = Date.now()
  for (const listener of listeners) {
    listener()
  }
}

let interval: ReturnType<typeof setInterval> | undefined

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  if (interval === undefined) {
    interval = setInterval(tick, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && interval !== undefined) {
      clearInterval(interval)
      interval = undefined
    }
  }
}

const getSnapshot = (): number => nowMs

// Live "now" in epoch ms; re-renders the caller every second.
export const useNow = (): number => useSyncExternalStore(subscribe, getSnapshot)

export const now = (): number => Date.now()
