import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { anatomy } from '#src/providers/ThemeProvider/anatomy'
import { DARK_QUERY, DEFAULT_STORAGE_KEY } from '#src/providers/ThemeProvider/constants'
import {
  type ResolvedTheme,
  ThemeContext,
  type ThemeMode,
  type UseThemeResult,
} from '#src/providers/ThemeProvider/context'

const prefersDark = (): boolean => window.matchMedia(DARK_QUERY).matches

// Subscribe half of useSyncExternalStore: fires on every OS theme flip, even when mode is explicit.
const subscribePrefersDark = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

// Anything but an explicit choice means system, so a cleared or corrupt store degrades to the OS.
const readMode = (storageKey: string): ThemeMode => {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Props for {@link ThemeProvider}. `storageKey` isolates two apps sharing an origin; it is read on
 * mount, so changing it later moves where writes go without re-reading the new key.
 *
 * @example
 * <ThemeProvider storageKey="vesting-theme">{children}</ThemeProvider>
 *
 * @category Components
 */
export interface ThemeProviderProps {
  children: ReactNode
  storageKey?: string
}

/**
 * Owns the light / dark / system choice: persists it, follows the OS while on `system`, tracks the
 * key across tabs, and writes the resolved value to `data-theme` on `<html>`, which is what
 * `@bootnodedev/canton-theme` keys its dark values on. Renders no DOM of its own.
 *
 * The attribute lands before the tree below it paints, but not before the page background; that
 * flash is accepted, and `architecture.md` has the reasoning. Client-only, because it reads the OS
 * preference while picking its initial state, so a server render throws.
 *
 * @example
 * createRoot(el).render(
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>,
 * )
 *
 * @category Components
 */
export const ThemeProvider = ({
  children,
  storageKey = DEFAULT_STORAGE_KEY,
}: ThemeProviderProps): ReactElement => {
  const [mode, setStoredMode] = useState<ThemeMode>(() => readMode(storageKey))
  const systemDark = useSyncExternalStore(subscribePrefersDark, prefersDark)
  const resolved: ResolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  // Layout, not passive: the attribute has to land before the browser paints the tree below.
  useLayoutEffect(() => {
    document.documentElement.setAttribute(anatomy.states.theme, resolved)
  }, [resolved])

  // Another tab switching mode would otherwise leave this one showing the old theme until reload.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      // A null key means the whole store was cleared, so the choice is gone either way.
      if (event.key === null || event.key === storageKey) {
        setStoredMode(readMode(storageKey))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const setMode = useCallback(
    (next: ThemeMode): void => {
      setStoredMode(next)
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        // Private-mode storage throws; the switch still applies, it just will not survive a reload.
      }
    },
    [storageKey],
  )

  const value = useMemo<UseThemeResult>(
    () => ({
      mode,
      resolved,
      setMode,
      toggle: () => setMode(resolved === 'dark' ? 'light' : 'dark'),
    }),
    [mode, resolved, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
