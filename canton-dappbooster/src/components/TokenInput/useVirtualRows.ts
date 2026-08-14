import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const DEFAULT_OVERSCAN = 4

interface UseVirtualRowsOptions {
  count: number
  overscan?: number
  resetKey?: unknown
  rowHeight: number
  scrollRef: RefObject<HTMLElement | null>
}

interface UseVirtualRowsResult {
  end: number
  offset: number
  scrollRowIntoView: (index: number) => void
  start: number
  totalHeight: number
}

/**
 * Windows a uniform-height list. The hook owns every scroll write, so move it with
 * `scrollRowIntoView`, or hand it a `resetKey` that changes when the rendered sequence does and it
 * rewinds itself: the window is computed from state, which a `scrollTop` written on the node behind
 * the hook's back leaves pointing at the offset it was computed for.
 *
 * @example
 * const { end, offset, start, totalHeight } = useVirtualRows({ count: rows.length, rowHeight: 56, scrollRef })
 * rows.slice(start, end)
 */
export const useVirtualRows = ({
  count,
  overscan = DEFAULT_OVERSCAN,
  resetKey,
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

  const scrollTo = useCallback(
    (top: number): void => {
      const node = scrollRef.current
      if (node !== null) node.scrollTop = top
      setScrollTop(top)
    },
    [scrollRef],
  )

  // Reads the node rather than the state above, so two moves batched into one render still stack.
  const scrollRowIntoView = useCallback(
    (index: number): void => {
      const node = scrollRef.current
      if (node === null) return
      const top = index * rowHeight
      scrollTo(Math.max(top + rowHeight - node.clientHeight, Math.min(node.scrollTop, top)))
    },
    [rowHeight, scrollRef, scrollTo],
  )

  // Held in a ref rather than state so the mount pass has nothing to rewind and costs no commit.
  const applied = useRef(resetKey)
  useLayoutEffect(() => {
    if (applied.current === resetKey) return
    applied.current = resetKey
    scrollTo(0)
  }, [resetKey, scrollTo])

  // Clamped to the count, so a list that shrinks under a scrolled viewport still renders its tail.
  const first = Math.min(Math.floor(scrollTop / rowHeight), Math.max(0, count - 1))
  const start = Math.max(0, first - overscan)
  const end = Math.min(count, start + Math.ceil(viewport / rowHeight) + 1 + overscan * 2)

  return {
    end,
    offset: start * rowHeight,
    scrollRowIntoView,
    start,
    totalHeight: count * rowHeight,
  }
}
