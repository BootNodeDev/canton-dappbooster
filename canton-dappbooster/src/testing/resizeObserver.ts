import { vi } from 'vitest'

/**
 * Stubs the `ResizeObserver` jsdom does not ship. Returns a trigger that fires every observer,
 * for a test that needs to act on a size change; anything that only needs the constructor to
 * exist, such as a popover whose positioner watches its reference, can ignore it.
 *
 * @example
 * const resized = stubResizeObserver()
 * act(() => resized())
 */
export const stubResizeObserver = (): (() => void) => {
  const observers = new Set<() => void>()

  class StubResizeObserver {
    private readonly notify: () => void

    constructor(callback: ResizeObserverCallback) {
      this.notify = () => callback([], this as unknown as ResizeObserver)
    }

    observe(): void {
      observers.add(this.notify)
    }

    unobserve(): void {
      observers.delete(this.notify)
    }

    disconnect(): void {
      observers.delete(this.notify)
    }
  }

  // `unstubGlobals` in vitest.config.ts puts the real one back after each test.
  vi.stubGlobal('ResizeObserver', StubResizeObserver)

  return () => {
    for (const notify of observers) {
      notify()
    }
  }
}
