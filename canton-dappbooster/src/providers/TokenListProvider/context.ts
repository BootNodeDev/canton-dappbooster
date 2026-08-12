import type { ReactNode } from 'react'
import { type Context, createContext } from 'react'

/**
 * A token in the list a picker chooses from. Structurally a `TokenMeta`, so a selected `Token` goes
 * straight to `<TokenInput token={...}>` without a mapping step.
 *
 * @example
 * const cc: Token = { decimals: 10, id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' }
 */
export interface Token {
  decimals: number
  id: string
  logo?: ReactNode
  name: string
  symbol: string
}

/**
 * Return shape of {@link useTokenList}
 *
 * @example
 * const { tokens, byId } = useTokenList()
 * const selected = byId.get(storedId) ?? tokens[0]
 */
export interface UseTokenListResult {
  byId: ReadonlyMap<string, Token>
  tokens: readonly Token[]
}

export const TokenListContext: Context<UseTokenListResult | undefined> = createContext<
  UseTokenListResult | undefined
>(undefined)
