import type { KeyboardEvent, ReactElement } from 'react'
import type { Token } from '../../providers/TokenListProvider/context'
import { TokenLogo } from '../TokenLogo'
import { modalAnatomy as anatomy } from './anatomy'
import { ROW_HEIGHT_REM } from './constants'

interface TokenRowProps {
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onSelect: (token: Token) => void
  selected: boolean
  tabbable: boolean
  token: Token
}

/**
 * One row of the token select's list. `tabbable` is the list's roving tab stop, so exactly one row
 * carries it: a tab stop per row is what the windowing exists to avoid.
 *
 * @example
 * <TokenRow onFocus={() => setActiveId(token.id)} onKeyDown={move} onSelect={setToken}
 *   selected={token.id === selectedId} tabbable={index === active} token={token} />
 */
export const TokenRow = ({
  onFocus,
  onKeyDown,
  onSelect,
  selected,
  tabbable,
  token,
}: TokenRowProps): ReactElement => (
  <button
    aria-label={`${token.name} ${token.symbol}`}
    aria-pressed={selected}
    className={anatomy.parts.row}
    onClick={() => onSelect(token)}
    onFocus={onFocus}
    onKeyDown={onKeyDown}
    style={{ height: `${ROW_HEIGHT_REM}rem` }}
    tabIndex={tabbable ? 0 : -1}
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
