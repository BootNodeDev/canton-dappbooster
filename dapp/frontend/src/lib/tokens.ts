import type { Token } from '@bootnodedev/canton-dappbooster'

// Canton Coin, `Amulet` on the ledger.
export const CC: Token = {
  id: 'canton-coin',
  name: 'Canton Coin',
  symbol: 'CC',
}

// No logos anywhere: there are no token images yet, so every row exercises the placeholder.
const NAMED: Token[] = [
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
  { id: 'usdt', name: 'Tether', symbol: 'USDT' },
  { id: 'wbtc', name: 'Wrapped Bitcoin', symbol: 'WBTC' },
  { id: 'weth', name: 'Wrapped Ether', symbol: 'WETH' },
]

export const FAVORITE_IDS: readonly string[] = [CC.id, 'usdt', 'usdc']

// Padded well past the list's own height so the scrolling and the windowing are visible in a browser.
const FILLER: Token[] = Array.from({ length: 60 }, (_, index) => ({
  id: `mock-${index}`,
  name: `Mock Instrument ${index + 1}`,
  symbol: `MK${index + 1}`,
}))

export const TOKENS: Token[] = [CC, ...NAMED, ...FILLER]
