import {
  type InstrumentId,
  mergeTokens,
  type PartialToken,
  sumHoldings,
  type Token,
  TokenListProvider,
  tokenKey,
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
import type { Deployment, Instrument } from '@/backend/deployment'
import { useBackend } from '@/providers/Backend'
import { USDX, type VaultToken, VSH } from '@/utils/tokens'

const idOf = ({ admin, id }: Instrument): InstrumentId => ({ admin, id })

const row = (instrument: Instrument, token: VaultToken): PartialToken => ({
  instrumentId: idOf(instrument),
  logo: token.logo,
  name: instrument.name,
  symbol: instrument.symbol,
})

// This vault's two instruments are the whole catalogue: there is no asset list or registry to ask.
const fromDeployment = ({ share, underlying }: Deployment): readonly PartialToken[] => [
  row(underlying, USDX),
  row(share, VSH),
]

// A row carries a figure or not, so this is what tells a failed read from one still running.
export interface TokenFigures {
  failed: boolean
  refresh: () => void
  vaultBalance: string | undefined
}

const FiguresContext = createContext<TokenFigures | undefined>(undefined)

export const Tokens = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { error: holdingsError, holdings, refetch: refetchHoldings } = useHoldings()
  const { backend, deployment } = useBackend()
  const [vaultBalance, setVaultBalance] = useState<string>()
  const [vaultFailed, setVaultFailed] = useState(false)
  // Only the newest read may report. Bumped on unmount too, so a read in flight then lands nowhere.
  const newest = useRef(0)

  // Read as the vault party, which this user may: the bootstrap granted it `CanActAs` on the vault.
  const readVault = useCallback((): void => {
    newest.current += 1
    const request = newest.current
    setVaultBalance(undefined)
    setVaultFailed(false)
    if (backend === undefined || deployment === undefined) return
    const underlying = tokenKey(deployment.underlying)
    backend.holdingsOf(deployment.vault).then(
      (held) => {
        if (request !== newest.current) return
        const found = sumHoldings(held).find(
          ({ instrumentId }) => tokenKey(instrumentId) === underlying,
        )
        setVaultBalance(found?.balance ?? '0')
      },
      () => {
        if (request === newest.current) setVaultFailed(true)
      },
    )
  }, [backend, deployment])

  useEffect(() => {
    readVault()
    return () => {
      newest.current += 1
    }
  }, [readVault])

  // Its identity moves with the session and not with the figures, so a mount can ask for a read.
  const refresh = useCallback(() => {
    readVault()
    refetchHoldings()
  }, [readVault, refetchHoldings])

  const figures = useMemo<TokenFigures>(
    () => ({ failed: vaultFailed || holdingsError !== undefined, refresh, vaultBalance }),
    [holdingsError, refresh, vaultBalance, vaultFailed],
  )

  const tokens = useMemo<readonly Token[]>(() => {
    if (deployment === undefined) return []
    // Scoped to this vault's pair: an older deployment's token shares an id under another admin.
    const keys = new Set([deployment.underlying, deployment.share].map((one) => tokenKey(one)))
    const held = sumHoldings(holdings ?? []).filter(({ instrumentId }) =>
      keys.has(tokenKey(instrumentId)),
    )
    const rows = mergeTokens([fromDeployment(deployment), held])
    // Once the read answers, a token missing from it is one the party holds none of.
    if (holdings === undefined) return rows
    return rows.map((one) => (one.balance === undefined ? { ...one, balance: '0' } : one))
  }, [deployment, holdings])

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
