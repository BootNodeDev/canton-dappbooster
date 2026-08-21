import { type ReactElement, type ReactNode, useMemo } from 'react'
import {
  type Token,
  TokenListContext,
  type UseTokenListResult,
} from '#src/providers/TokenListProvider/context'

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
 * Supplies the token list every picker in the tree chooses from, plus the `byId` lookup a consumer
 * needs to turn a stored token id back into a token. Renders no DOM of its own, and there is no
 * ambient fallback: `useTokenList` throws without it, because a picker with nothing to pick from is
 * worse than one that fails loudly in dev.
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
  const value = useMemo<UseTokenListResult>(
    () => ({
      byId: new Map(tokens.map((token) => [token.id, token])),
      tokens,
    }),
    [tokens],
  )

  return <TokenListContext.Provider value={value}>{children}</TokenListContext.Provider>
}
