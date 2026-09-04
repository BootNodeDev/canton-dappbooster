import {
  type KeyboardEvent,
  type ReactElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { dialogAnatomy as anatomy } from '#src/components/TokenInput/anatomy'
import { NO_TOKENS, ROW_HEIGHT_REM } from '#src/components/TokenInput/constants'
import { filterTokens, toNeedle } from '#src/components/TokenInput/filterTokens'
import { TokenRow } from '#src/components/TokenInput/TokenRow'
import { useRemPx } from '#src/components/TokenInput/useRemPx'
import { useVirtualRows } from '#src/components/TokenInput/useVirtualRows'
import type { Token } from '#src/providers/TokenListProvider/context'
import { useTokenList } from '#src/providers/TokenListProvider/useTokenList'
import { SR_ONLY } from '#src/utils/srOnly'
import { tokenKey } from '#src/utils/tokenKey'

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

// Builds the text for the live region that tells a screen reader how far the search
// narrowed the list.
const announce = (needle: string, count: number): string =>
  needle === ''
    ? ''
    : count === 0
      ? NO_TOKENS
      : count === 1
        ? '1 token found'
        : `${count} tokens found`

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

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 0) / rowHeight))
    const next = nextIndex(event.key, active, page, tokens.length - 1)
    if (next === undefined) return
    event.preventDefault()
    moveTo(next)
  }

  const onRowFocus = (token: Token): void => {
    hadFocus.current = true
    setActiveKey(tokenKey(token.instrumentId))
  }

  const row = (token: Token, index: number): ReactElement => (
    <TokenRow
      key={tokenKey(token.instrumentId)}
      onFocus={() => onRowFocus(token)}
      onKeyDown={onKeyDown}
      onSelect={onSelect}
      tabbable={index === active}
      token={token}
    />
  )

  // Keeps the one row that holds focus mounted after scrolling has pushed it out of
  // the rendered window.
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
      {/* live region for screen readers */}
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
