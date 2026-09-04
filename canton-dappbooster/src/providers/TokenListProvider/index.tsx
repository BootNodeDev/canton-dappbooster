import { type ReactElement, type ReactNode, useMemo } from 'react'
import {
  type Token,
  TokenListContext,
  type UseTokenListResult,
} from '#src/providers/TokenListProvider/context'
import { parseAmount } from '#src/utils/tokenAmount'
import { tokenKey } from '#src/utils/tokenKey'

// Turns a token's balance into a number the sort can compare
const held = (token: Token): bigint => parseAmount(token.balance ?? '') ?? -1n

const byBalance = (left: Token, right: Token): number => {
  const a = held(left)
  const b = held(right)
  if (a === b) return 0
  return a > b ? -1 : 1
}

/**
 * Props for {@link TokenListProvider}. `tokens` is read by identity, so hoist the array or memoise
 * it; a fresh one on every render rebuilds the lookup map.
 *
 * @example
 * <TokenListProvider tokens={mockTokens}>{children}</TokenListProvider>
 *
 * @category Components
 */
export interface TokenListProviderProps {
  children: ReactNode
  tokens: readonly Token[]
}

/**
 * Supplies the token list every picker in the tree chooses from.
 *
 * @example
 * <TokenListProvider tokens={tokens}>
 *   <TokenInput label="Amount" token={selected} value={amount} onChange={setAmount}
 *     onTokenSelect={setSelected} />
 * </TokenListProvider>
 *
 * @category Components
 */
export const TokenListProvider = ({ children, tokens }: TokenListProviderProps): ReactElement => {
  const value = useMemo<UseTokenListResult>(() => {
    const sorted = [...tokens].sort(byBalance)
    return {
      byKey: new Map(sorted.map((token) => [tokenKey(token.instrumentId), token])),
      tokens: sorted,
    }
  }, [tokens])

  return <TokenListContext.Provider value={value}>{children}</TokenListContext.Provider>
}
