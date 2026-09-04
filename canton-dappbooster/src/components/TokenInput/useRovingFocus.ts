import {
  type KeyboardEvent,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { dialogAnatomy as anatomy } from '#src/components/TokenInput/anatomy'
import { nextIndex } from '#src/components/TokenInput/nextIndex'
import type { Token } from '#src/providers/TokenListProvider/context'
import { tokenKey } from '#src/utils/tokenKey'

interface UseRovingFocusOptions {
  needle: string
  rowHeight: number
  scrollRef: RefObject<HTMLElement | null>
  scrollRowIntoView: (index: number) => void
  tokens: readonly Token[]
}

interface UseRovingFocusResult {
  active: number
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onRowFocus: (token: Token) => void
}

/**
 * The one tab stop a windowed list walks on: which row holds it, the keys that move it, and the
 * focus a scroll would otherwise drop when it unmounts the row holding it.
 *
 * @example
 * const { active, onKeyDown, onRowFocus } = useRovingFocus({
 *   needle,
 *   rowHeight,
 *   scrollRef,
 *   scrollRowIntoView,
 *   tokens,
 * })
 */
export const useRovingFocus = ({
  needle,
  rowHeight,
  scrollRef,
  scrollRowIntoView,
  tokens,
}: UseRovingFocusOptions): UseRovingFocusResult => {
  // Held by key, not by index: a provider handing over an equal-but-new array must not move it.
  const [activeKey, setActiveKey] = useState<string>()
  const active = useMemo(
    () =>
      Math.max(
        0,
        tokens.findIndex((token) => tokenKey(token.instrumentId) === activeKey),
      ),
    [activeKey, tokens],
  )
  // Raised only by the keys that move the tab stop
  // A re-render from scrolling never pulls focus.
  const pullFocus = useRef(false)
  const hadFocus = useRef(false)

  // A new needle makes the old tab stop meaningless, so it goes back to the top; no token has an
  // unset key, which is what lands it on the first row.
  const [applied, setApplied] = useState(needle)
  if (applied !== needle) {
    setApplied(needle)
    setActiveKey(undefined)
  }

  const focusActive = (): void => {
    scrollRef.current?.querySelector<HTMLElement>(`.${anatomy.parts.row}[tabindex="0"]`)?.focus()
  }

  // Puts focus back where it belongs, once per commit, before the browser paints.
  useLayoutEffect(() => {
    const node = scrollRef.current
    if (node === null) return
    if (pullFocus.current || (hadFocus.current && document.activeElement === document.body)) {
      pullFocus.current = false
      focusActive()
    }
    hadFocus.current = node.contains(document.activeElement)
  })

  const moveTo = (index: number): void => {
    const next = Math.max(0, Math.min(tokens.length - 1, index))
    scrollRowIntoView(next)
    if (next === active) {
      focusActive()
      return
    }
    pullFocus.current = true
    setActiveKey(tokenKey(tokens[next].instrumentId))
  }

  return {
    active,
    onKeyDown: (event) => {
      const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 0) / rowHeight))
      const next = nextIndex(event.key, active, page, tokens.length - 1)
      if (next === undefined) return
      event.preventDefault()
      moveTo(next)
    },
    onRowFocus: (token) => {
      hadFocus.current = true
      setActiveKey(tokenKey(token.instrumentId))
    },
  }
}
