import type { Token } from '@bootnodedev/canton-dappbooster'
import cantonCoin from '@/assets/canton-coin.png'

// The artwork is the Canton Coin mark. The kit's logo slot is 2rem with `overflow: hidden`, so it
// has to be told to fit.
export const AMT: Token = {
  id: 'canton-coin',
  logo: <img alt="" className="size-full object-contain" src={cantonCoin} />,
  name: 'Amulet',
  symbol: 'AMT',
}

// The only instrument this deployment knows.
export const TOKENS: Token[] = [AMT]
