import type { Token } from '../../providers/TokenListProvider/context'

// `id` stands in for the address criterion: a `Token` carries no address field, and a caller with
// on-chain tokens puts the identifier it filters by there.
const matches = (token: Token, needle: string): boolean =>
  token.name.toLowerCase().includes(needle) ||
  token.symbol.toLowerCase().includes(needle) ||
  token.id.toLowerCase().includes(needle)

/**
 * Narrows a token list to what a query matches
 *
 * @example
 * const shown = filterTokens(tokens, 'ca')
 */
export const filterTokens = (tokens: readonly Token[], query: string): readonly Token[] => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return tokens
  return tokens.filter((token) => matches(token, needle))
}
