import type { Token } from '@bootnodedev/canton-dappbooster'
import cantonCoin from '@/assets/canton-coin.png'

// Canton Coin, `Amulet` on the ledger. The kit's logo slot is 2rem with `overflow: hidden`, so the
// artwork has to be told to fit it.
export const CC: Token = {
  id: 'canton-coin',
  logo: <img alt="" className="size-full object-contain" src={cantonCoin} />,
  name: 'Canton Coin',
  symbol: 'CC',
}

// The only instrument this deployment knows.
export const TOKENS: Token[] = [CC]
