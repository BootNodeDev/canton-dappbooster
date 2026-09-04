import type { KeyboardEvent, ReactElement } from 'react'
import { dialogAnatomy as anatomy } from '#src/components/TokenInput/anatomy'
import { ROW_HEIGHT_REM } from '#src/components/TokenInput/constants'
import { getLockedFigure } from '#src/components/TokenInput/getLockedFigure'
import { getTokenLabel } from '#src/components/TokenInput/getTokenLabel'
import { TokenLogo } from '#src/components/TokenLogo'
import { LockIcon } from '#src/icons'
import type { Token } from '#src/providers/TokenListProvider/context'
import { formatAmount } from '#src/utils/tokenAmount'

interface TokenRowProps {
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onSelect: (token: Token) => void
  tabbable: boolean
  token: Token
}

/**
 * One row of the token select's list. `tabbable` is the list's roving tab stop, so exactly one row
 * carries it: a tab stop per row is what the windowing exists to avoid.
 *
 * @example
 * <TokenRow onFocus={() => setActiveKey(tokenKey(token.instrumentId))} onKeyDown={move}
 *   onSelect={setToken} tabbable={index === active} token={token} />
 */
export const TokenRow = ({
  onFocus,
  onKeyDown,
  onSelect,
  tabbable,
  token,
}: TokenRowProps): ReactElement => {
  const balance = token.balance === undefined ? undefined : formatAmount(token.balance)
  const locked = getLockedFigure(token)

  return (
    <button
      aria-label={getTokenLabel(token)}
      className={anatomy.parts.row}
      onClick={() => onSelect(token)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      style={{ height: `${ROW_HEIGHT_REM}rem` }}
      tabIndex={tabbable ? 0 : -1}
      type="button"
    >
      <TokenLogo className={anatomy.parts.rowLogo} logo={token.logo} symbol={token.symbol} />
      <span className={anatomy.parts.rowText}>
        <span className={anatomy.parts.rowName}>{token.name}</span>
        <span className={anatomy.parts.rowSymbol}>{token.symbol}</span>
      </span>
      {(balance !== undefined || locked !== undefined) && (
        <span className={anatomy.parts.rowFigures}>
          {balance !== undefined && <span className={anatomy.parts.rowBalance}>{balance}</span>}
          {locked !== undefined && (
            <span className={anatomy.parts.rowLocked}>
              {locked}
              <LockIcon />
            </span>
          )}
        </span>
      )}
    </button>
  )
}
