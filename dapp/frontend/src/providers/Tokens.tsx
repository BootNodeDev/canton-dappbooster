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
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import { addAmounts, subtractAmounts } from '@/utils/amount'
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

// The figures this app can act on, which are not the ledger's: what is free to fund a grant is the
// balance, and coin a pending grant pledged joins the escrowed coin as locked. The three still sum
// to everything held, so the row hides nothing.
const fromVesting = (
  rows: readonly PartialToken[],
  free: string | undefined,
): readonly PartialToken[] =>
  free === undefined
    ? []
    : rows
        .filter(
          ({ balance, instrumentId }) => instrumentId.id === AMULET_ID && balance !== undefined,
        )
        .map(({ balance = '0', instrumentId, locked = '0' }) => ({
          balance: free,
          instrumentId,
          locked: addAmounts(locked, subtractAmounts(balance, free)),
        }))

// A row carries a figure or it does not, so a read that failed and one still running look the same
// on it. This is what tells them apart, and what lets a field say so.
export interface TokenFigures {
  failed: boolean
}

const FiguresContext = createContext<TokenFigures | undefined>(undefined)

export const Tokens = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { error: holdingsError, holdings } = useHoldings()
  const { backend } = useBackend()
  const { party } = useParty()
  const partyId = party?.partyId
  const [instruments, setInstruments] = useState<readonly Instrument[]>([])
  const [curated, setCurated] = useState<readonly AssetListEntry[]>([])
  const [free, setFree] = useState<string>()
  const [freeFailed, setFreeFailed] = useState(false)

  useEffect(() => {
    if (backend === undefined || partyId === undefined) return
    let live = true
    setFreeFailed(false)
    backend.balanceOf(partyId).then(
      (value) => {
        if (live) setFree(value)
      },
      () => {
        if (live) setFreeFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [backend, partyId])

  const figures = useMemo<TokenFigures>(
    () => ({ failed: freeFailed || holdingsError !== undefined }),
    [freeFailed, holdingsError],
  )

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
    const rows = mergeTokens([
      ...sources,
      fromApp(sources.flat()),
      fromVesting(sumHoldings(holdings ?? []), free),
    ])
    // The read enumerates every holding, so once it answers, a token missing from it is one the
    // party holds none of rather than one nobody asked about.
    if (holdings === undefined) return rows
    return rows.map((row) => (row.balance === undefined ? { ...row, balance: '0' } : row))
  }, [curated, free, holdings, instruments])

  return (
    <FiguresContext.Provider value={figures}>
      <TokenListProvider tokens={tokens}>{children}</TokenListProvider>
    </FiguresContext.Provider>
  )
}

export const useTokenFigures = (): TokenFigures => {
  const state = useContext(FiguresContext)
  if (state === undefined) {
    throw new Error('useTokenFigures must be used within a Tokens')
  }
  return state
}
