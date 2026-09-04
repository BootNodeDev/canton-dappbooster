import cantonCoin from '@/assets/canton-coin.png'

// The id the Amulet registry serves. The admin party is the network's own DSO, so it is read off
// the holdings rather than written down here.
export const AMULET_ID = 'Amulet'

// The artwork is the Canton Coin mark. The kit's logo slot is 2rem with `overflow: hidden`, so it
// has to be told to fit.
export const AMT = {
  logo: <img alt="" className="size-full object-contain" src={cantonCoin} />,
  name: 'Amulet',
  symbol: 'AMT',
}
