import { useContext } from 'react'
import { ThemeContext, type UseThemeResult } from '#src/providers/ThemeProvider/context'

/**
 * Reads and sets the theme mode. Requires a {@link ThemeProvider} above it; there is no ambient
 * fallback, because a control that silently fails to switch is worse than one that throws in dev.
 *
 * @example
 * const { resolved, toggle } = useTheme()
 * <button onClick={toggle}>{resolved === 'dark' ? 'Light' : 'Dark'} mode</button>
 */
export const useTheme = (): UseThemeResult => {
  const value = useContext(ThemeContext)
  if (value === undefined) {
    throw new Error('useTheme must be used inside a <ThemeProvider>')
  }
  return value
}
