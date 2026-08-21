import { useContext } from 'react'
import { TokenListContext, type UseTokenListResult } from '#src/providers/TokenListProvider/context'

/**
 * Reads the token list a {@link TokenListProvider} supplies. Reach for it where a screen renders
 * its own token UI; `<TokenInput onTokenSelect>` already reads it itself.
 *
 * @throws with no {@link TokenListProvider} above it.
 *
 * @example
 * const { tokens } = useTokenList()
 * tokens.map((token) => <TokenRow key={token.id} token={token} />)
 *
 * @category Hooks
 */
export const useTokenList = (): UseTokenListResult => {
  const value = useContext(TokenListContext)
  if (value === undefined) {
    throw new Error('useTokenList must be used inside a <TokenListProvider>')
  }
  return value
}
