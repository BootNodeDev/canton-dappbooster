import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import { TokenMark } from '@/icons'

// The kit's logo slot is 2rem with `overflow: hidden`, so artwork has to be told to fit.
export const tokenLogo = (src: string): React.JSX.Element => (
  <img alt="" className="size-full object-contain" src={src} />
)

// The instrument this deployment vests, as the app spells it in its own copy and marks. It carries
// no `instrumentId`: the admin is minted per bootstrap run, so the identity comes from the registry
// through `useBackend().instrument` and this is only the artwork and the words.
export const DBT: TokenMeta & { name: string } = {
  logo: <TokenMark className="size-full" />,
  name: 'dAppBooster Token',
  symbol: 'DBT',
}
