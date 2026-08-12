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
import { modalAnatomy as anatomy } from './anatomy'
import { ROW_HEIGHT_REM } from './constants'
import { filterTokens } from './filterTokens'
import { TokenRow } from './TokenRow'
import { useRemPx } from './useRemPx'
import { useVirtualRows } from './useVirtualRows'

interface TokenListProps {
  onSelect: (token: Token) => void
  query?: string
  selectedId?: string
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

/**
 * The token select's scrolling list. Windowed, so it walks on one roving tab stop and the arrow
 * keys instead of a tab stop per token: the rows out of view are not in the DOM to tab to.
 *
 * @example
 * <TokenList onSelect={(token) => { onTokenSelect(token); onClose() }} selectedId={token.id} />
 */
export const TokenList = ({ onSelect, query = '', selectedId }: TokenListProps): ReactElement => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { tokens: all } = useTokenList()
  const tokens = useMemo(() => filterTokens(all, query), [all, query])
  const rowHeight = useRemPx(ROW_HEIGHT_REM)
  const { end, offset, start, totalHeight } = useVirtualRows({
    count: tokens.length,
    rowHeight,
    scrollRef,
  })

  const [moved, setActive] = useState(() =>
    Math.max(
      0,
      tokens.findIndex((token) => token.id === selectedId),
    ),
  )
  // The reset below lands a render later, so this one still holds an index the new list may not have.
  const active = Math.min(moved, Math.max(0, tokens.length - 1))
  // Raised only by the keys that move the tab stop, so a re-render from scrolling never pulls focus.
  const pullFocus = useRef(false)
  const hadFocus = useRef(false)

  // A new list makes the old tab stop and scroll offset meaningless, so both go back to the top.
  const [shown, setShown] = useState(tokens)
  const rewind = useRef(false)
  if (shown !== tokens) {
    setShown(tokens)
    setActive(0)
    rewind.current = true
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
    if (rewind.current) {
      rewind.current = false
      node.scrollTop = 0
    }
    if (pullFocus.current || (hadFocus.current && document.activeElement === document.body)) {
      pullFocus.current = false
      focusActive()
    }
    hadFocus.current = node.contains(document.activeElement)
  })

  const moveTo = (index: number): void => {
    const next = Math.max(0, Math.min(tokens.length - 1, index))
    const node = scrollRef.current
    if (node !== null) {
      const top = next * rowHeight
      node.scrollTop = Math.max(top + rowHeight - node.clientHeight, Math.min(node.scrollTop, top))
    }
    if (next === active) {
      focusActive()
      return
    }
    pullFocus.current = true
    setActive(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 0) / rowHeight))
    const next = nextIndex(event.key, active, page, tokens.length - 1)
    if (next === undefined) return
    event.preventDefault()
    moveTo(next)
  }

  const onRowFocus = (index: number): void => {
    hadFocus.current = true
    setActive(index)
  }

  const row = (token: Token, index: number): ReactElement => (
    <TokenRow
      key={token.id}
      onFocus={() => onRowFocus(index)}
      onKeyDown={onKeyDown}
      onSelect={onSelect}
      selected={token.id === selectedId}
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
      {/* Mounted while the list has rows: a live region must precede the change it announces. */}
      <p className={anatomy.parts.empty} role="status">
        {tokens.length === 0 ? 'No tokens found' : ''}
      </p>
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
