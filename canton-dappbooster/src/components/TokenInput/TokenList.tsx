import {
  type KeyboardEvent,
  type ReactElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Token } from '../../providers/TokenListProvider/context'
import { useTokenList } from '../../providers/TokenListProvider/useTokenList'
import { SR_ONLY } from '../../utils/srOnly'
import { dialogAnatomy as anatomy } from './anatomy'
import { NO_TOKENS, ROW_HEIGHT_REM } from './constants'
import { filterTokens, toNeedle } from './filterTokens'
import { TokenRow } from './TokenRow'
import { useRemPx } from './useRemPx'
import { useVirtualRows } from './useVirtualRows'

interface TokenListProps {
  onSelect: (token: Token) => void
  query?: string
}

const nextIndex = (key: string, active: number, page: number, last: number): number | undefined => {
  switch (key) {
    case 'ArrowDown':
      return active + 1
    case 'ArrowUp':
      return active - 1
    case 'PageDown':
      return active + page
    case 'PageUp':
      return active - page
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return undefined
  }
}

// The narrowing is otherwise carried only by rows going missing, which nobody is reading. Silent
// without a needle, so mounting a list never announces a count nobody asked for.
const announce = (needle: string, count: number): string => {
  if (needle === '') return ''
  if (count === 0) return NO_TOKENS
  return count === 1 ? '1 token found' : `${count} tokens found`
}

/**
 * The token select's scrolling list. Windowed, so it walks on one roving tab stop and the arrow
 * keys instead of a tab stop per token: the rows out of view are not in the DOM to tab to.
 *
 * @example
 * <TokenList onSelect={(token) => { onTokenSelect(token); onClose() }} />
 */
export const TokenList = ({ onSelect, query = '' }: TokenListProps): ReactElement => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { tokens: all } = useTokenList()
  const needle = toNeedle(query)
  const tokens = useMemo(() => filterTokens(all, needle), [all, needle])
  const rowHeight = useRemPx(ROW_HEIGHT_REM)
  const { end, offset, scrollRowIntoView, start, totalHeight } = useVirtualRows({
    count: tokens.length,
    resetKey: needle,
    rowHeight,
    scrollRef,
  })

  // Held by id, not by index: a provider handing over an equal-but-new array must not move it.
  const [activeId, setActiveId] = useState<string>()
  const active = useMemo(
    () =>
      Math.max(
        0,
        tokens.findIndex((token) => token.id === activeId),
      ),
    [activeId, tokens],
  )
  // Raised only by the keys that move the tab stop, so a re-render from scrolling never pulls focus.
  const pullFocus = useRef(false)
  const hadFocus = useRef(false)

  // A new needle makes the old tab stop meaningless, so it goes back to the top; no token carries
  // an unset id, which is what lands it on the first row.
  const [applied, setApplied] = useState(needle)
  if (applied !== needle) {
    setApplied(needle)
    setActiveId(undefined)
  }

  const focusActive = (): void => {
    scrollRef.current?.querySelector<HTMLElement>(`.${anatomy.parts.row}[tabindex="0"]`)?.focus()
  }

  // Two jobs per commit: hand focus to the tab stop the keys just moved, and take it back when a
  // scroll re-rendered the row that held it. Focus landing on `body` is what tells the two apart
  // from the caller having tabbed away, which re-renders nothing.
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
    setActiveId(tokens[next].id)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 0) / rowHeight))
    const next = nextIndex(event.key, active, page, tokens.length - 1)
    if (next === undefined) return
    event.preventDefault()
    moveTo(next)
  }

  const onRowFocus = (token: Token): void => {
    hadFocus.current = true
    setActiveId(token.id)
  }

  const row = (token: Token, index: number): ReactElement => (
    <TokenRow
      key={token.id}
      onFocus={() => onRowFocus(token)}
      onKeyDown={onKeyDown}
      onSelect={onSelect}
      tabbable={index === active}
      token={token}
    />
  )

  // Kept mounted at its own offset once the scroll leaves it behind: unmounting the row that holds
  // focus drops the caller back to the top of the document.
  const stray =
    tokens.length > 0 && (active < start || active >= end) ? (
      <div
        className={anatomy.parts.rows}
        style={{ transform: `translateY(${active * rowHeight}px)` }}
      >
        {row(tokens[active], active)}
      </div>
    ) : null

  return (
    <section aria-label="Tokens" className={anatomy.parts.list} ref={scrollRef}>
      {/* Out of flow and always mounted: a live region must precede the change it announces, and
          an in-flow one would offset the rows the sizer positions. */}
      <span className={anatomy.parts.status} role="status" style={SR_ONLY}>
        {announce(needle, tokens.length)}
      </span>
      {tokens.length === 0 && <p className={anatomy.parts.empty}>{NO_TOKENS}</p>}
      <div className={anatomy.parts.sizer} style={{ height: totalHeight }}>
        {active < start && stray}
        <div className={anatomy.parts.rows} style={{ transform: `translateY(${offset}px)` }}>
          {tokens.slice(start, end).map((token, index) => row(token, start + index))}
        </div>
        {active >= end && stray}
      </div>
    </section>
  )
}
