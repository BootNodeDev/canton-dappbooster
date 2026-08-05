import { type Context, createContext } from 'react'

/**
 * What the user picked. `system` defers to the OS and keeps following it.
 *
 * @example
 * setMode('system')
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * What is actually on the document: `system` resolved against the OS preference.
 *
 * @example
 * const icon = resolved === 'dark' ? <MoonIcon /> : <SunIcon />
 */
export type ResolvedTheme = 'light' | 'dark'

/**
 * Return shape of {@link useTheme}. `toggle` is a two-way switch: it leaves `system` for the
 * opposite of what is showing.
 *
 * @example
 * const { mode, resolved, setMode, toggle } = useTheme()
 */
export interface UseThemeResult {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

export const ThemeContext: Context<UseThemeResult | undefined> = createContext<
  UseThemeResult | undefined
>(undefined)
