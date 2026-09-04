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
import { type AssetListEntry, readAssetList } from '@/utils/assetList'
import { ASSET_LIST_NETWORK, ASSET_LIST_URL, REGISTRY_URL } from '@/utils/config'
import { AMT, AMULET_ID } from '@/utils/tokens'

type Meta = Partial<Token>

// The app supplies the artwork and wins on the label, because this deployment calls the instrument
// what its own UI calls it.
const appMeta = ({ id }: InstrumentId): Meta => (id === AMULET_ID ? AMT : {})

const registryMeta = (known: Instrument | undefined): Meta =>
  known === undefined ? {} : { name: known.name, symbol: known.symbol }

// The curated list is one repo's file rather than a standard, so it is trusted for artwork and for
// the symbol its maintainers publish, never for the amounts or the identity.
const curatedMeta = (entry: AssetListEntry | undefined): Meta =>
  entry === undefined
    ? {}
    : {
        symbol: entry.symbol,
        ...(entry.logoUrl === undefined
          ? {}
          : { logo: <img alt="" className="size-full object-contain" src={entry.logoUrl} /> }),
      }

const byInstrument = <T extends { instrumentId: InstrumentId }>(
  entries: readonly T[],
): ReadonlyMap<string, T> => new Map(entries.map((one) => [tokenKey(one.instrumentId), one]))

export const Tokens = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { holdings } = useHoldings()
  const [instruments, setInstruments] = useState<readonly Instrument[]>([])
  const [curated, setCurated] = useState<readonly AssetListEntry[]>([])

  useEffect(() => {
    let live = true
    // A source that will not answer costs labels, not rows: the holdings list either way.
    readInstruments(REGISTRY_URL).then(
      (found) => {
        if (live) setInstruments(found)
      },
      () => undefined,
    )
    if (ASSET_LIST_NETWORK !== undefined) {
      readAssetList(ASSET_LIST_URL, ASSET_LIST_NETWORK).then(
        (found) => {
          if (live) setCurated(found)
        },
        () => undefined,
      )
    }
    return () => {
      live = false
    }
  }, [])

  const tokens = useMemo<Token[]>(() => {
    const known = byInstrument(instruments)
    const published = byInstrument(curated)
    return sumHoldings(holdings ?? []).map(({ balance, instrumentId, locked }) => {
      const key = tokenKey(instrumentId)
      const meta = {
        ...registryMeta(known.get(key)),
        ...curatedMeta(published.get(key)),
        ...appMeta(instrumentId),
      }
      return {
        balance,
        instrumentId,
        locked,
        logo: meta.logo,
        // A raw id reads badly, and reads worse as a missing row.
        name: meta.name ?? instrumentId.id,
        symbol: meta.symbol ?? instrumentId.id,
      }
    })
  }, [curated, holdings, instruments])

  return <TokenListProvider tokens={tokens}>{children}</TokenListProvider>
}
