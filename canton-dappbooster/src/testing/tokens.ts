import type { Token } from '#src/providers/TokenListProvider/context'

/**
 * The two-token list the token select's tests render against. Two is enough to tell a filtered row
 * from an unfiltered one; a test needing a hundred builds its own. Neither carries a balance, so a
 * test asserting on one sets it and the rest keep the order they were given.
 *
 * @example
 * render(<TokenListProvider tokens={TOKENS}><TokenSelectDialog {...props} /></TokenListProvider>)
 */
export const TOKENS: Token[] = [
  { instrumentId: { admin: 'DSO::1220ab', id: 'Amulet' }, name: 'Canton Coin', symbol: 'CC' },
  { instrumentId: { admin: 'circle::1220cd', id: 'USDC' }, name: 'USD Coin', symbol: 'USDC' },
]
