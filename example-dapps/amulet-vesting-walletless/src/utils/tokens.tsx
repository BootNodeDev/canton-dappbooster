import cantonCoin from '@/assets/canton-coin.png'

// The one token this dApp moves. The kit's logo slot is 2rem with `overflow: hidden`, so the
// artwork (the Canton Coin mark) has to be told to fit.
export const AMT = {
  logo: <img alt="" className="size-full object-contain" src={cantonCoin} />,
  name: 'Amulet',
  symbol: 'AMT',
}
