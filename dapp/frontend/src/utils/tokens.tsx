import type { Token } from '@bootnodedev/canton-dappbooster'
import cantonCoin from '@/assets/canton-coin.png'

// The artwork is the Canton Coin mark. The kit's logo slot is 2rem with `overflow: hidden`, so it
// has to be told to fit.
// The admin is the DSO party, which the app only learns once a wallet connects, so it stays empty
// until the holdings read supplies the list this stands in for.
export const AMT: Token = {
  instrumentId: { admin: '', id: 'Amulet' },
  logo: <img alt="" className="size-full object-contain" src={cantonCoin} />,
  name: 'Amulet',
  symbol: 'AMT',
}

// The only instrument this deployment knows.
export const TOKENS: Token[] = [AMT]
