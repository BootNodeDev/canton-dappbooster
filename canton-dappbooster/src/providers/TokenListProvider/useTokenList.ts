import { useContext } from 'react'
import { TokenListContext, type UseTokenListResult } from './context'

/**
 * Reads the token list
 *
 * @example
 * const { tokens } = useTokenList()
 * tokens.map((token) => <TokenRow key={token.id} token={token} />)
 */
export const useTokenList = (): UseTokenListResult => {
  const value = useContext(TokenListContext)
  if (value === undefined) {
    throw new Error('useTokenList must be used inside a <TokenListProvider>')
  }
  return value
}
