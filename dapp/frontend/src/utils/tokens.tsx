import type { Token } from '@bootnodedev/canton-dappbooster'
import { TokenMark } from '@/icons'

// The canton-token-forge instrument this deployment vests. `id` is the kit's UI key for its token
// list and is unrelated to the on-ledger `instrumentId`, which is `DBT`.
export const DBT: Token = {
  id: 'dbt',
  logo: <TokenMark className="size-full" />,
  name: 'dAppBooster Token',
  symbol: 'DBT',
}

// The only instrument this deployment knows.
export const TOKENS: Token[] = [DBT]
