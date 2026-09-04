import { getLockedFigure } from '#src/components/TokenInput/getLockedFigure'
import type { Token } from '#src/providers/TokenListProvider/context'
import { formatAmount } from '#src/utils/tokenAmount'

// The accessible name a token is announced by
export const getTokenLabel = (token: Token): string => {
  const locked = getLockedFigure(token)
  const parts = [`${token.name} ${token.symbol}`]

  if (token.balance !== undefined) {
    parts.push(`balance ${formatAmount(token.balance)}`)
  }

  if (locked !== undefined) {
    parts.push(`${locked} locked`)
  }

  return parts.join(', ')
}
