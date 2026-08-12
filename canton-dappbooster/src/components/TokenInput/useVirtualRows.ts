import { type RefObject, useEffect, useLayoutEffect, useState } from 'react'

const DEFAULT_OVERSCAN = 4

interface UseVirtualRowsOptions {
  count: number
  overscan?: number
  rowHeight: number
  scrollRef: RefObject<HTMLElement | null>
}

interface UseVirtualRowsResult {
  end: number
  offset: number
  start: number
  totalHeight: number
}

/**
 * Windows a uniform-height list.
 *
 * @example
 * const { end, offset, start, totalHeight } = useVirtualRows({ count: rows.length, rowHeight: 56, scrollRef })
 * rows.slice(start, end)
 */
export const useVirtualRows = ({
  count,
  overscan = DEFAULT_OVERSCAN,
  rowHeight,
  scrollRef,
}: UseVirtualRowsOptions): UseVirtualRowsResult => {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(0)

  // Measured on a window listener, not a ResizeObserver: this list's height only changes with the
  // viewport, and jsdom ships no observer to test against.
  useLayoutEffect(() => {
    const node = scrollRef.current
    if (node === null) return
    const measure = (): void => setViewport(node.clientHeight)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [scrollRef])

  useEffect(() => {
    const node = scrollRef.current
    if (node === null) return
    const onScroll = (): void => setScrollTop(node.scrollTop)
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [scrollRef])

  // Clamped to the count, so a list that shrinks under a scrolled viewport still renders its tail.
  const first = Math.min(Math.floor(scrollTop / rowHeight), Math.max(0, count - 1))
  const start = Math.max(0, first - overscan)
  const end = Math.min(count, start + Math.ceil(viewport / rowHeight) + 1 + overscan * 2)

  return { end, offset: start * rowHeight, start, totalHeight: count * rowHeight }
}
