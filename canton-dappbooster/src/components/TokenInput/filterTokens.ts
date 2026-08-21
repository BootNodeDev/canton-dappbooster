import type { Token } from '#src/providers/TokenListProvider/context'

// Held per token rather than per keystroke: the same three strings would otherwise be lowercased
// again for every character typed, over a list long enough to have needed windowing.
const haystacks = new WeakMap<Token, { id: string; name: string; symbol: string }>()

const haystack = (token: Token): { id: string; name: string; symbol: string } => {
  const cached = haystacks.get(token)
  if (cached !== undefined) return cached
  const next = {
    id: token.id.toLowerCase(),
    name: token.name.toLowerCase(),
    symbol: token.symbol.toLowerCase(),
  }
  haystacks.set(token, next)
  return next
}

/**
 * Normalizes a query to what {@link filterTokens} matches on. Key a memo on this rather than on the
 * raw query, so typing a space either side re-runs nothing.
 *
 * @example
 * const tokens = useMemo(() => filterTokens(all, toNeedle(query)), [all, toNeedle(query)])
 */
export const toNeedle = (query: string): string => query.trim().toLowerCase()

/**
 * Narrows a token list to what a query matches, symbol matches first, then name, then id.
 *
 * @example
 * const shown = filterTokens(tokens, 'ca')
 */
export const filterTokens = (tokens: readonly Token[], query: string): readonly Token[] => {
  const needle = toNeedle(query)
  if (needle === '') return tokens
  const bySymbol: Token[] = []
  const byName: Token[] = []
  const byId: Token[] = []
  for (const token of tokens) {
    const { id, name, symbol } = haystack(token)
    // `id` stands in for the address criterion: a `Token` carries no address field, and a caller
    // with on-chain tokens puts the identifier it filters by there. Prefix-only and ranked last, so
    // a short query does not bury the readable matches under every hash that happens to contain it.
    if (symbol.includes(needle)) bySymbol.push(token)
    else if (name.includes(needle)) byName.push(token)
    else if (id.startsWith(needle)) byId.push(token)
  }
  return [...bySymbol, ...byName, ...byId]
}
