import { vi } from 'vitest'
import { stubResizeObserver } from '#src/testing/resizeObserver'

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

  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height)
  const resized = stubResizeObserver()

  return (next: number) => {
    height = next
    resized()
  }
}
