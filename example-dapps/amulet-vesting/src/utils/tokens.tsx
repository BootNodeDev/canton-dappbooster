import type { InstrumentId } from '@bootnodedev/canton-dappbooster'
import cantonCoin from '@/assets/canton-coin.png'

// The id the Amulet registry serves. The admin party is the network's own DSO, so it is read off
// the holdings rather than written down here.
const AMULET_ID = 'Amulet'

export const isAmulet = ({ id }: InstrumentId): boolean => id === AMULET_ID

// The kit's logo slot is 2rem with `overflow: hidden`, so artwork has to be told to fit.
export const tokenLogo = (src: string): React.JSX.Element => (
  <img alt="" className="size-full object-contain" src={src} />
)

// The artwork is the Canton Coin mark.
export const AMT = {
  logo: tokenLogo(cantonCoin),
  name: 'Amulet',
  symbol: 'AMT',
}
