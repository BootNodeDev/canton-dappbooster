import type { Token } from '#src/providers/TokenListProvider/context'

/**
 * The two-token list the token select's tests render against. Two is enough to tell a filtered row
 * from an unfiltered one; a test needing a hundred builds its own.
 *
 * @example
 * render(<TokenListProvider tokens={TOKENS}><TokenSelectDialog {...props} /></TokenListProvider>)
 */
export const TOKENS: Token[] = [
  { id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
]
