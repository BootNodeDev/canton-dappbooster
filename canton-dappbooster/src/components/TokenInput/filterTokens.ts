import type { Token } from '../../providers/TokenListProvider/context'

const NO_MATCH = Number.POSITIVE_INFINITY

// `id` stands in for the address criterion: a `Token` carries no address field, and a caller with
// on-chain tokens puts the identifier it filters by there. Prefix-only and ranked last, so a short
// query does not bury the readable matches under every hash that happens to contain it.
const rank = (token: Token, needle: string): number => {
  if (token.symbol.toLowerCase().includes(needle)) return 0
  if (token.name.toLowerCase().includes(needle)) return 1
  return token.id.toLowerCase().startsWith(needle) ? 2 : NO_MATCH
}

/**
 * Narrows a token list to what a query matches, symbol matches first, then name, then id.
 *
 * @example
 * const shown = filterTokens(tokens, 'ca')
 */
export const filterTokens = (tokens: readonly Token[], query: string): readonly Token[] => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return tokens
  return tokens
    .map((token) => ({ rank: rank(token, needle), token }))
    .filter((match) => match.rank !== NO_MATCH)
    .sort((one, other) => one.rank - other.rank)
    .map((match) => match.token)
}
