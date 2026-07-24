import type { JSX } from 'react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext, type ThemeMode } from '@/theme/ThemeContext'

const STORAGE_KEY = 'bn-canton-stampbook:theme'

const readStoredMode = (): ThemeMode | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // ignore
  }
  return null
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps): JSX.Element => {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? 'system')

  useEffect(() => {
    const root = document.documentElement
    if (mode !== 'system') {
      root.dataset.theme = mode
      return
    }
    // System mode: resolve from a single MediaQueryList and follow its changes.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      root.dataset.theme = media.matches ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore quota / privacy errors
    }
  }, [])

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
