import { vi } from 'vitest'

/**
 * jsdom lays nothing out and ships no `ResizeObserver`, so a windowed list reads a height of zero
 * and never learns it changed. Stubs both. Returns a setter that resizes and notifies the
 * observers, which is the only way to exercise a list whose card reflowed under it.
 *
 * @example
 * const resize = stubViewport(4 * ROW_HEIGHT)
 * act(() => resize(8 * ROW_HEIGHT))
 */
export const stubViewport = (initial: number): ((next: number) => void) => {
  let height = initial
  const observers = new Set<() => void>()

  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height)

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

  return (next: number) => {
    height = next
    for (const notify of observers) {
      notify()
    }
  }
}
