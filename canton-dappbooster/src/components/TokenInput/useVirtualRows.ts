import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react'

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
  scrollToTop: () => void
  start: number
  totalHeight: number
}

/**
 * Windows a uniform-height list. Rewind it with `scrollToTop` rather than by writing `scrollTop`
 * on the node: a programmatic scroll fires no scroll event, so the window would keep the offset it
 * was computed for.
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

  // Observed rather than measured off `window.resize`: the list is a flex item under a capped card,
  // so anything above it growing resizes it with the window untouched.
  useLayoutEffect(() => {
    const node = scrollRef.current
    if (node === null) return
    const measure = (): void => setViewport(node.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [scrollRef])

  useEffect(() => {
    const node = scrollRef.current
    if (node === null) return
    const onScroll = (): void => setScrollTop(node.scrollTop)
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [scrollRef])

  const scrollToTop = useCallback((): void => {
    const node = scrollRef.current
    if (node !== null) node.scrollTop = 0
    setScrollTop(0)
  }, [scrollRef])

  // Clamped to the count, so a list that shrinks under a scrolled viewport still renders its tail.
  const first = Math.min(Math.floor(scrollTop / rowHeight), Math.max(0, count - 1))
  const start = Math.max(0, first - overscan)
  const end = Math.min(count, start + Math.ceil(viewport / rowHeight) + 1 + overscan * 2)

  return { end, offset: start * rowHeight, scrollToTop, start, totalHeight: count * rowHeight }
}
