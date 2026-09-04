import {
  type InstrumentId,
  sumHoldings,
  type Token,
  TokenListProvider,
} from '@bootnodedev/canton-dappbooster'
import { useHoldings } from '@bootnodedev/canton-dappbooster/connect'
import { type ReactNode, useMemo } from 'react'
import { AMT, AMULET_ID } from '@/utils/tokens'

// This deployment knows one instrument by id, and an id is not unique, so anything else the party
// holds is listed under its own id rather than hidden.
const metaFor = ({ id }: InstrumentId): { logo?: ReactNode; name: string; symbol: string } =>
  id === AMULET_ID ? AMT : { name: id, symbol: id }

/**
 * The token list every picker reads, built from what the connected party actually holds.
 */
export const Tokens = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { holdings } = useHoldings()

  const tokens = useMemo<Token[]>(
    () =>
      sumHoldings(holdings ?? []).map(({ balance, instrumentId, locked }) => ({
        ...metaFor(instrumentId),
        balance,
        instrumentId,
        locked,
      })),
    [holdings],
  )

  return <TokenListProvider tokens={tokens}>{children}</TokenListProvider>
}
