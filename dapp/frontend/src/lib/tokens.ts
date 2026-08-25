import type { Token } from '@bootnodedev/canton-dappbooster'

// Canton Coin, `Amulet` on the ledger.
export const CC: Token = {
  id: 'canton-coin',
  name: 'Canton Coin',
  symbol: 'CC',
}

// The only instrument this deployment knows. No logo: there are no token images yet, so the row
// exercises the placeholder.
export const TOKENS: Token[] = [CC]
