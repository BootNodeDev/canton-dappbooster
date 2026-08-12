import type { ReactElement } from 'react'
import type { Token } from '../../providers/TokenListProvider/context'
import { TokenLogo } from '../TokenLogo'
import { modalAnatomy as anatomy } from './anatomy'
import { ROW_HEIGHT } from './constants'

interface TokenRowProps {
  onSelect: (token: Token) => void
  selected: boolean
  token: Token
}

/**
 * One row of the token select's list.
 *
 * @example
 * <TokenRow onSelect={setToken} selected={token.id === selectedId} token={token} />
 */
export const TokenRow = ({ onSelect, selected, token }: TokenRowProps): ReactElement => (
  <button
    aria-label={`${token.name} ${token.symbol}`}
    aria-pressed={selected}
    className={anatomy.parts.row}
    onClick={() => onSelect(token)}
    style={{ height: ROW_HEIGHT }}
    type="button"
    {...{ [anatomy.states.selected]: selected || undefined }}
  >
    <TokenLogo className={anatomy.parts.rowLogo} logo={token.logo} symbol={token.symbol} />
    <span className={anatomy.parts.rowText}>
      <span className={anatomy.parts.rowName}>{token.name}</span>
      <span className={anatomy.parts.rowSymbol}>{token.symbol}</span>
    </span>
  </button>
)
