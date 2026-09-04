import {
  type Instrument,
  type InstrumentId,
  readInstruments,
  sumHoldings,
  type Token,
  TokenListProvider,
  tokenKey,
} from '@bootnodedev/canton-dappbooster'
import { useHoldings } from '@bootnodedev/canton-dappbooster/connect'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { REGISTRY_URL } from '@/utils/config'
import { AMT, AMULET_ID } from '@/utils/tokens'

// The app supplies the artwork and wins on the label, because the registry serves no logo and this
// deployment calls the instrument what its own UI calls it.
const appMeta = ({ id }: InstrumentId): Partial<Token> => (id === AMULET_ID ? AMT : {})

// Last resort for an instrument no registry answered for: a raw id reads badly, and reads worse as
// a missing row.
const rawMeta = ({ id }: InstrumentId): { name: string; symbol: string } => ({
  name: id,
  symbol: id,
})

export const Tokens = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { holdings } = useHoldings()
  const [instruments, setInstruments] = useState<readonly Instrument[]>([])

  useEffect(() => {
    let live = true
    readInstruments(REGISTRY_URL).then(
      (found) => {
        if (live) setInstruments(found)
      },
      // A registry that will not answer costs labels, not rows: the holdings still list.
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [])

  const tokens = useMemo<Token[]>(() => {
    const byKey = new Map(instruments.map((one) => [tokenKey(one.instrumentId), one]))
    return sumHoldings(holdings ?? []).map(({ balance, instrumentId, locked }) => {
      const known = byKey.get(tokenKey(instrumentId))
      return {
        ...rawMeta(instrumentId),
        ...(known === undefined ? {} : { name: known.name, symbol: known.symbol }),
        ...appMeta(instrumentId),
        balance,
        instrumentId,
        locked,
      }
    })
  }, [holdings, instruments])

  return <TokenListProvider tokens={tokens}>{children}</TokenListProvider>
}
