import { useLayoutEffect, useState } from 'react'

const FALLBACK = 16

const rootFontSize = (): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || FALLBACK

/**
 * Resolves a rem length to the px a layout calculation needs, following the root font size.
 *
 * @example
 * const rowHeight = useRemPx(3.25)
 */
export const useRemPx = (rem: number): number => {
  const [root, setRoot] = useState(FALLBACK)

  // Read before paint, so the first render's window is never measured against the wrong scale.
  useLayoutEffect(() => {
    const measure = (): void => setRoot(rootFontSize())
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return rem * root
}
