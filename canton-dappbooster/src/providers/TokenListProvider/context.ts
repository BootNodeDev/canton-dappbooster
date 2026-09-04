import type { ReactNode } from 'react'
import { type Context, createContext } from 'react'

/**
 * What identifies a token on Canton: the party administering the registry that issued it, and the
 * id it carries there. Two fields, so {@link tokenKey} is what turns one into a map or React key.
 *
 * @example
 * const amulet: InstrumentId = { admin: 'DSO::1220ab', id: 'Amulet' }
 *
 * @category Hooks
 */
export interface InstrumentId {
  admin: string
  id: string
}

/**
 * A token in the list a picker chooses from. Structurally a `TokenMeta`, so a selected `Token` goes
 * straight to `<TokenInput token={...}>`. `balance` is what the party can spend and `locked` what it
 * cannot, both off a holdings read: with no `balance` the row shows no figure and sorts last.
 *
 * @example
 * const cc: Token = {
 *   balance: '12.5',
 *   instrumentId: { admin: 'DSO::1220ab', id: 'Amulet' },
 *   locked: '100',
 *   name: 'Canton Coin',
 *   symbol: 'CC',
 * }
 *
 * @category Hooks
 */
export interface Token {
  balance?: string
  instrumentId: InstrumentId
  locked?: string
  logo?: ReactNode
  name: string
  symbol: string
}

/**
 * Return shape of {@link useTokenList}. `byKey` is built from `tokens`, so the two never disagree,
 * and both carry the balance-first order the provider settled on.
 *
 * @example
 * const { byKey, tokens } = useTokenList()
 * const selected = byKey.get(tokenKey(instrumentId)) ?? tokens[0]
 *
 * @category Hooks
 */
export interface UseTokenListResult {
  byKey: ReadonlyMap<string, Token>
  tokens: readonly Token[]
}

export const TokenListContext: Context<UseTokenListResult | undefined> = createContext<
  UseTokenListResult | undefined
>(undefined)
