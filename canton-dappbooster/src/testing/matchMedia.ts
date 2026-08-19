import { vi } from 'vitest'
import { DARK_QUERY } from '#src/providers/ThemeProvider/constants'

type Listener = (event: MediaQueryListEvent) => void

/**
 * jsdom's `matchMedia` always reports `matches: false` and never fires a change event, so anything
 * reading the OS colour preference has to stub it. Returns a setter that flips the preference and
 * notifies listeners, which is the only way to exercise system mode.
 *
 * @example
 * const setPrefersDark = stubPrefersDark(false)
 * act(() => setPrefersDark(true))
 */
export const stubPrefersDark = (initial: boolean): ((next: boolean) => void) => {
  let matches = initial
  const listeners = new Set<Listener>()

  const list = {
    get matches() {
      return matches
    },
    addEventListener: (_type: 'change', listener: Listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: 'change', listener: Listener) => {
      listeners.delete(listener)
    },
  } as unknown as MediaQueryList

  const matchMedia = (query: string): MediaQueryList => {
    if (query !== DARK_QUERY) {
      throw new Error(`unexpected media query: ${query}`)
    }
    return list
  }

  // `unstubGlobals` in vitest.config.ts puts the real one back after each test.
  vi.stubGlobal('matchMedia', matchMedia)

  return (next: boolean) => {
    matches = next
    for (const listener of listeners) {
      listener({ matches } as MediaQueryListEvent)
    }
  }
}
