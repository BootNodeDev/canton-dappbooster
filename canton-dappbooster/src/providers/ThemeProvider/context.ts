import { type Context, createContext } from 'react'

/** What the user picked. `system` defers to the OS and keeps following it. */
export type ThemeMode = 'light' | 'dark' | 'system'

/** What is actually on the document: `system` resolved against the OS preference. */
export type ResolvedTheme = 'light' | 'dark'

/** Return shape of {@link useTheme}. */
export interface UseThemeResult {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  /** Two-way switch: leaves `system` for the opposite of what is showing. */
  toggle: () => void
}

export const ThemeContext: Context<UseThemeResult | undefined> = createContext<
  UseThemeResult | undefined
>(undefined)
