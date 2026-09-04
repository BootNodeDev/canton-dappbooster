import {
  type Instrument,
  mergeTokens,
  type PartialToken,
  readInstruments,
  sumHoldings,
  type Token,
  TokenListProvider,
} from '@bootnodedev/canton-dappbooster'
import { useHoldings } from '@bootnodedev/canton-dappbooster/connect'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { type AssetListEntry, readAssetList } from '@/utils/assetList'
import { ASSET_LIST_NETWORK, ASSET_LIST_URL, REGISTRY_URL } from '@/utils/config'
import { AMT, AMULET_ID } from '@/utils/tokens'

const fromCurated = (entries: readonly AssetListEntry[]): readonly PartialToken[] =>
  entries.map(({ instrumentId, logoUrl, symbol }) => ({
    instrumentId,
    symbol,
    ...(logoUrl === undefined
      ? {}
      : { logo: <img alt="" className="size-full object-contain" src={logoUrl} /> }),
  }))

const fromRegistries = (instruments: readonly Instrument[]): readonly PartialToken[] =>
  instruments.map(({ instrumentId, name, symbol }) => ({ instrumentId, name, symbol }))

const fromApp = (rows: readonly PartialToken[]): readonly PartialToken[] =>
  rows
    .filter(({ instrumentId }) => instrumentId.id === AMULET_ID)
    .map(({ instrumentId }) => ({ instrumentId, logo: AMT.logo }))

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
    const published = curated
      .map(({ registryUrls }) => registryUrls[0])
      .filter((url) => url !== undefined)
    return [...new Set([REGISTRY_URL, ...published])]
  }, [curated])

  useEffect(() => {
    let live = true
    // A registry that will not answer costs labels, not rows: the other sources still list.
    Promise.all(registryUrls.map((url) => readInstruments(url).catch(() => []))).then((found) => {
      if (live) setInstruments(found.flat())
    })
    return () => {
      live = false
    }
  }, [registryUrls])

  const tokens = useMemo<readonly Token[]>(() => {
    const sources = [fromCurated(curated), fromRegistries(instruments), sumHoldings(holdings ?? [])]
    const rows = mergeTokens([...sources, fromApp(sources.flat())])
    // The read enumerates every holding, so once it answers, a token missing from it is one the
    // party holds none of rather than one nobody asked about.
    if (holdings === undefined) return rows
    return rows.map((row) => (row.balance === undefined ? { ...row, balance: '0' } : row))
  }, [curated, holdings, instruments])

  return <TokenListProvider tokens={tokens}>{children}</TokenListProvider>
}
