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

const appMeta = ({ id }: InstrumentId): Meta => (id === AMULET_ID ? AMT : {})

const registryMeta = (known: Instrument | undefined): Meta =>
  known === undefined ? {} : { name: known.name, symbol: known.symbol }

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

  const registryUrls = useMemo(() => {
    const published = new Map(
      curated.map(({ instrumentId, registryUrls }) => [instrumentId.admin, registryUrls[0]]),
    )
    const admins = new Set((holdings ?? []).map(({ instrumentId }) => instrumentId.admin))
    return [...new Set([...admins].map((admin) => published.get(admin) ?? REGISTRY_URL))]
  }, [curated, holdings])

  useEffect(() => {
    let live = true
    // A registry that will not answer costs labels, not rows: the holdings list either way.
    Promise.all(registryUrls.map((url) => readInstruments(url).catch(() => []))).then((found) => {
      if (live) setInstruments(found.flat())
    })
    return () => {
      live = false
    }
  }, [registryUrls])

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
        name: meta.name ?? instrumentId.id,
        symbol: meta.symbol ?? instrumentId.id,
      }
    })
  }, [curated, holdings, instruments])

  return <TokenListProvider tokens={tokens}>{children}</TokenListProvider>
}
