import {
  type Instrument,
  type InstrumentBalance,
  mergeTokens,
  type PartialToken,
  readInstruments,
  sumHoldings,
  type Token,
  TokenListProvider,
} from '@bootnodedev/canton-dappbooster'
import { useHoldings } from '@bootnodedev/canton-dappbooster/connect'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import { addAmounts, subtractAmounts } from '@/utils/amount'
import { type AssetListEntry, readAssetList } from '@/utils/assetList'
import { ASSET_LIST_NETWORK, ASSET_LIST_URL, REGISTRY_URL } from '@/utils/config'
import { AMT, isAmulet, tokenLogo } from '@/utils/tokens'

const fromCurated = (entries: readonly AssetListEntry[]): readonly PartialToken[] =>
  entries.map(({ instrumentId, logoUrl, symbol }) => ({
    instrumentId,
    logo: logoUrl === undefined ? undefined : tokenLogo(logoUrl),
    symbol,
  }))

const fromRegistries = (instruments: readonly Instrument[]): readonly PartialToken[] =>
  instruments.map(({ instrumentId, name, symbol }) => ({ instrumentId, name, symbol }))

const fromApp = (rows: readonly PartialToken[]): readonly PartialToken[] =>
  rows
    .filter(({ instrumentId }) => isAmulet(instrumentId))
    .map(({ instrumentId }) => ({ instrumentId, logo: AMT.logo }))

// The figures this app can act on, which are not the ledger's: what is free to fund a grant is the
// balance, and coin a pending grant pledged joins the escrowed coin as locked. The three still sum
// to everything held, so the row hides nothing.
const fromVesting = (
  held: readonly InstrumentBalance[],
  free: string | undefined,
): readonly PartialToken[] =>
  free === undefined
    ? []
    : held
        .filter(({ instrumentId }) => isAmulet(instrumentId))
        .map(({ balance, instrumentId, locked }) => ({
          balance: free,
          instrumentId,
          locked: addAmounts(locked, subtractAmounts(balance, free)),
        }))

// A row carries a figure or it does not, so a read that failed and one still running look the same
// on it. This is what tells them apart, and what lets a field say so.
export interface TokenFigures {
  failed: boolean
  refresh: () => void
}

const FiguresContext = createContext<TokenFigures | undefined>(undefined)

export const Tokens = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { error: holdingsError, holdings, refetch: refetchHoldings } = useHoldings()
  const { backend } = useBackend()
  const { party } = useParty()
  const partyId = party?.partyId
  const [instruments, setInstruments] = useState<readonly Instrument[]>([])
  const [curated, setCurated] = useState<readonly AssetListEntry[]>([])
  const [free, setFree] = useState<string>()
  const [freeFailed, setFreeFailed] = useState(false)
  // Only the newest read may report. Bumped on unmount too, so a read in flight then lands nowhere.
  const newest = useRef(0)

  // The figure belongs to one party, so it goes when that party does and when the read that owns it
  // fails: kept, it would report the last party's spendable coin as this one's.
  const readFree = useCallback((): void => {
    newest.current += 1
    const request = newest.current
    setFree(undefined)
    setFreeFailed(false)
    if (backend === undefined || partyId === undefined) return
    backend.balanceOf(partyId).then(
      (value) => {
        if (request === newest.current) setFree(value)
      },
      () => {
        if (request === newest.current) setFreeFailed(true)
      },
    )
  }, [backend, partyId])

  useEffect(() => {
    readFree()
    return () => {
      newest.current += 1
    }
  }, [readFree])

  // Its identity moves with the session and not with the figures, so a caller can ask for a read on
  // mount without a failed one asking again forever.
  const refresh = useCallback(() => {
    readFree()
    refetchHoldings()
  }, [readFree, refetchHoldings])

  const figures = useMemo<TokenFigures>(
    () => ({ failed: freeFailed || holdingsError !== undefined, refresh }),
    [freeFailed, holdingsError, refresh],
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
    const held = sumHoldings(holdings ?? [])
    const sources: readonly (readonly PartialToken[])[] = [
      fromCurated(curated),
      fromRegistries(instruments),
      held,
    ]
    const rows = mergeTokens([...sources, fromApp(sources.flat()), fromVesting(held, free)])
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
