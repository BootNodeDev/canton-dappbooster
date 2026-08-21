import type { ReactNode } from 'react'
import { type Context, createContext } from 'react'

/**
 * A token in the list a picker chooses from. Structurally a `TokenMeta`, so a selected `Token` goes
 * straight to `<TokenInput token={...}>` without a mapping step.
 *
 * @example
 * const cc: Token = { id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' }
 *
 * @category Hooks
 */
export interface Token {
  id: string
  logo?: ReactNode
  name: string
  symbol: string
}

/**
 * Return shape of {@link useTokenList}. `byId` is built from `tokens`, so the two never disagree.
 *
 * @example
 * const { tokens, byId } = useTokenList()
 * const selected = byId.get(storedId) ?? tokens[0]
 *
 * @category Hooks
 */
export interface UseTokenListResult {
  byId: ReadonlyMap<string, Token>
  tokens: readonly Token[]
}

export const TokenListContext: Context<UseTokenListResult | undefined> = createContext<
  UseTokenListResult | undefined
>(undefined)
