import { type ReactElement, type ReactNode, useMemo } from 'react'
import { type Token, TokenListContext, type UseTokenListResult } from './context'

/**
 * Props for {@link TokenListProvider}
 *
 * @example
 * <TokenListProvider tokens={mockTokens}>{children}</TokenListProvider>
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
