import { type ReactElement, type ReactNode, useMemo } from 'react'
import {
  type Token,
  TokenListContext,
  type UseTokenListResult,
} from '#src/providers/TokenListProvider/context'
import { parseAmount } from '#src/utils/tokenAmount'
import { tokenKey } from '#src/utils/tokenKey'

// Turns a token's balance into a number the sort can compare. Taken once per token rather than
// inside the comparator, which would re-parse both sides of every comparison.
const held = (token: Token): bigint => parseAmount(token.balance ?? '') ?? -1n

const byBalance = (left: { held: bigint }, right: { held: bigint }): number => {
  if (left.held === right.held) return 0
  return left.held > right.held ? -1 : 1
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
    const sorted = tokens
      .map((token) => ({ held: held(token), token }))
      .sort(byBalance)
      .map(({ token }) => token)
    return {
      byKey: new Map(sorted.map((token) => [tokenKey(token.instrumentId), token])),
      tokens: sorted,
    }
  }, [tokens])

  return <TokenListContext.Provider value={value}>{children}</TokenListContext.Provider>
}
