import type { Token } from '@bootnodedev/canton-dappbooster'

// Canton Coin, `Amulet` on the ledger.
export const CC: Token = {
  decimals: 10,
  id: 'canton-coin',
  name: 'Canton Coin',
  symbol: 'CC',
}

// No logos anywhere: there are no token images yet, so every row exercises the placeholder.
const NAMED: Token[] = [
  { decimals: 6, id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
  { decimals: 6, id: 'usdt', name: 'Tether', symbol: 'USDT' },
  { decimals: 8, id: 'wbtc', name: 'Wrapped Bitcoin', symbol: 'WBTC' },
  { decimals: 18, id: 'weth', name: 'Wrapped Ether', symbol: 'WETH' },
]

// Padded well past the list's own height so the scrolling and the windowing are visible in a browser.
const FILLER: Token[] = Array.from({ length: 60 }, (_, index) => ({
  decimals: 10,
  id: `mock-${index}`,
  name: `Mock Instrument ${index + 1}`,
  symbol: `MK${index + 1}`,
}))

export const TOKENS: Token[] = [CC, ...NAMED, ...FILLER]
