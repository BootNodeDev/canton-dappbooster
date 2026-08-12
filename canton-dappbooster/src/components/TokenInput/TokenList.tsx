import { type ReactElement, useRef } from 'react'
import type { Token } from '../../providers/TokenListProvider/context'
import { useTokenList } from '../../providers/TokenListProvider/useTokenList'
import { modalAnatomy as anatomy } from './anatomy'
import { ROW_HEIGHT } from './constants'
import { TokenRow } from './TokenRow'
import { useVirtualRows } from './useVirtualRows'

interface TokenListProps {
  onSelect: (token: Token) => void
  selectedId?: string
}

/**
 * The token select's scrolling list
 *
 * @example
 * <TokenList onSelect={(token) => { onTokenSelect(token); onClose() }} selectedId={token.id} />
 */
export const TokenList = ({ onSelect, selectedId }: TokenListProps): ReactElement => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { tokens } = useTokenList()
  const { end, offset, start, totalHeight } = useVirtualRows({
    count: tokens.length,
    rowHeight: ROW_HEIGHT,
    scrollRef,
  })

  return (
    <div className={anatomy.parts.list} ref={scrollRef}>
      <div className={anatomy.parts.sizer} style={{ height: totalHeight }}>
        <div className={anatomy.parts.rows} style={{ transform: `translateY(${offset}px)` }}>
          {tokens.slice(start, end).map((token) => (
            <TokenRow
              key={token.id}
              onSelect={onSelect}
              selected={token.id === selectedId}
              token={token}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
