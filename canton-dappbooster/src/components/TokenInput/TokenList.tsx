import { type ReactElement, useMemo, useRef } from 'react'
import { dialogAnatomy as anatomy } from '#src/components/TokenInput/anatomy'
import { NO_TOKENS, ROW_HEIGHT_REM } from '#src/components/TokenInput/constants'
import { filterTokens, toNeedle } from '#src/components/TokenInput/filterTokens'
import { TokenRow } from '#src/components/TokenInput/TokenRow'
import { useRemPx } from '#src/components/TokenInput/useRemPx'
import { useRovingFocus } from '#src/components/TokenInput/useRovingFocus'
import { useVirtualRows } from '#src/components/TokenInput/useVirtualRows'
import type { Token } from '#src/providers/TokenListProvider/context'
import { useTokenList } from '#src/providers/TokenListProvider/useTokenList'
import { SR_ONLY } from '#src/utils/srOnly'
import { tokenKey } from '#src/utils/tokenKey'

interface TokenListProps {
  onSelect: (token: Token) => void
  query?: string
}

// Builds the text for the live region that tells a screen reader how far the search
// narrowed the list.
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
  const { active, onKeyDown, onRowFocus } = useRovingFocus({
    needle,
    rowHeight,
    scrollRef,
    scrollRowIntoView,
    tokens,
  })

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
