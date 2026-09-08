import type { Token } from '#src/providers/TokenListProvider/context'

interface Haystack {
  admin: string
  id: string
  name: string
  symbol: string
}

const haystacks = new WeakMap<Token, Haystack>()

// id, name, symbol or admin party
const haystack = (token: Token): Haystack => {
  const cached = haystacks.get(token)
  if (cached !== undefined) return cached
  const next = {
    admin: token.instrumentId.admin.toLowerCase(),
    id: token.instrumentId.id.toLowerCase(),
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
 * Narrows a token list to what a query matches: symbol matches first, then name, then either half
 * of the instrument id. The admin party is what tells two registries issuing one symbol apart, so
 * it is matched by prefix, which is how a pasted party id finds its token.
 *
 * @example
 * const shown = filterTokens(tokens, 'ca')
 */
export const filterTokens = (tokens: readonly Token[], query: string): readonly Token[] => {
  const needle = toNeedle(query)
  if (needle === '') return tokens
  const bySymbol: Token[] = []
  const byName: Token[] = []
  const byInstrument: Token[] = []
  for (const token of tokens) {
    const { admin, id, name, symbol } = haystack(token)
    if (symbol.includes(needle)) {
      bySymbol.push(token)
    } else if (name.includes(needle)) {
      byName.push(token)
    } else if (id.startsWith(needle) || admin.startsWith(needle)) {
      byInstrument.push(token)
    }
  }
  return [...bySymbol, ...byName, ...byInstrument]
}
