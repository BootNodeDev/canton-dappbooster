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
import { createBackend, isDeployed, loadBackendConfig } from '@/backend/createBackend'
import type { PartyRef, VestingBackend } from '@/backend/VestingBackend'
import { MockWallet } from '@/mock/MockWallet'
import { MOCK_OPERATOR } from '@/mock/seed'
import { StealthWallet } from '@/wallet/StealthWallet'
import type { Wallet } from '@/wallet/Wallet'

// DirectWalletProvider. Talks to the ledger through the active VestingBackend.
// "Connecting" is just choosing which party to act as; the party is remembered in
// localStorage so a reload lands back in the same session.

const STORAGE_KEY = 'vesting-ui:session'

type Session = { partyId?: string }

const readSession = (): Session => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return {}
    }
    return JSON.parse(raw) as Session
  } catch {
    return {}
  }
}

const writeSession = (session: Session): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore quota / privacy errors
  }
}

export interface WalletContextValue {
  pool: PartyRef[]
  operator: string
  party: PartyRef | undefined
  isConnected: boolean
  isConnecting: boolean
  backendAvailable: boolean
  backend: VestingBackend
  connect: (party: PartyRef) => void
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

export const WalletProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const initial = useMemo(readSession, [])
  const [pool, setPool] = useState<PartyRef[]>([])
  const [operator, setOperator] = useState('')
  const [party, setParty] = useState<PartyRef | undefined>(undefined)
  const [isConnecting, setIsConnecting] = useState(false)
  const [backendAvailable, setBackendAvailable] = useState(false)
  const [backend, setBackend] = useState<VestingBackend>(() =>
    createBackend({ rpcUrl: '', deployment: { pkg: '', operator: '' } }, new MockWallet()),
  )

  // Monotonically-increasing counter: each loadBackend call captures its own epoch
  // and bails out of all setState calls if a newer call has started by the time
  // any await resolves — prevents stale responses from overwriting newer state.
  const loadEpoch = useRef(0)

  // Load the pool + availability, rehydrating the acting party from the persisted
  // session only when it is still in the freshly-loaded pool.
  const loadBackend = useCallback(async (rememberedPartyId?: string): Promise<void> => {
    const epoch = ++loadEpoch.current
    setIsConnecting(true)
    try {
      const config = await loadBackendConfig()
      if (epoch !== loadEpoch.current) {
        return
      }
      const deployed = isDeployed(config)
      const wallet: Wallet = deployed ? new StealthWallet(config.rpcUrl) : new MockWallet()
      const nextBackend = createBackend(config, wallet)
      setBackend(nextBackend)
      const operatorId = deployed ? config.deployment.operator : MOCK_OPERATOR
      setOperator(operatorId)
      // Independent reads — run them together to save a round-trip in deployed mode.
      const [accounts, available] = await Promise.all([
        wallet.listParties().catch(() => [] as PartyRef[]),
        nextBackend.isAvailable(),
      ])
      if (epoch !== loadEpoch.current) {
        return
      }
      const nextPool = accounts.filter((account) => account.partyId !== operatorId)
      setPool(nextPool)
      setBackendAvailable(available)
      const remembered =
        rememberedPartyId === undefined
          ? undefined
          : nextPool.find((candidate) => candidate.partyId === rememberedPartyId)
      setParty(remembered)
    } finally {
      // Only the winning epoch clears the loading flag; a superseded call must
      // not reset it because the newer call already set its own isConnecting=true.
      if (epoch === loadEpoch.current) {
        setIsConnecting(false)
      }
    }
  }, [])

  // Initial load, rehydrating the remembered party.
  useEffect(() => {
    void loadBackend(initial.partyId)
  }, [loadBackend, initial.partyId])

  const connect = useCallback((next: PartyRef): void => {
    setParty(next)
    writeSession({ partyId: next.partyId })
  }, [])

  const disconnect = useCallback((): void => {
    setParty(undefined)
    writeSession({})
  }, [])

  const value = useMemo<WalletContextValue>(
    () => ({
      pool,
      operator,
      party,
      isConnected: party !== undefined,
      isConnecting,
      backendAvailable,
      backend,
      connect,
      disconnect,
    }),
    [pool, operator, party, isConnecting, backendAvailable, backend, connect, disconnect],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export const useWalletContext = (): WalletContextValue => {
  const ctx = useContext(WalletContext)
  if (ctx === undefined) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return ctx
}
