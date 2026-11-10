import { useSyncExternalStore } from 'react'

// One shared clock, so every figure on screen recomputes on the same tick
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

export const useNow = (): number => useSyncExternalStore(subscribe, getSnapshot)

export const now = (): number => Date.now()
