// CantonConnectProvider owns the wallet connection lifecycle and exposes it
// through React context. Hooks (useConnect, useParty, useSignMessage, etc.)
// are thin readers that subscribe to this context.

import type {
  AccountsChangedEvent,
  ProviderAdapter,
  StatusEvent,
  TxChangedEvent,
} from '@canton-network/dapp-sdk'
import { DappSDK, WalletConnectAdapter } from '@canton-network/dapp-sdk'
import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CantonConnectConfig, ConnectionStatus, Party } from './types'
import { toParties } from './walletAccount'

/**
 * Mirrored from the SDK's `txChanged` event as a command moves through
 * pending, signed, executed or failed.
 */
export interface TxStatusSnapshot {
  status: TxChangedEvent['status']
  commandId: TxChangedEvent['commandId']
  payload?: unknown
}

/**
 * The full connection state and actions behind every hook in this package.
 * Prefer the narrower hooks (`useConnect`, `useParty`, …); each picks a slice of this.
 */
export interface CantonConnectContextValue {
  config: CantonConnectConfig
  /** One per `CantonConnectProvider`, recreated only when `config.walletPicker` changes. */
  sdk: DappSDK
  party: Party | undefined
  /** Every usable party the wallet holds, primary first. `party` is always `parties[0]`. */
  parties: Party[]
  status: ConnectionStatus
  /** Connected-but-locked: a session exists, but must be unlocked to serve requests. */
  isLocked: boolean
  connectError: Error | undefined
  isConnecting: boolean
  lastTx: TxStatusSnapshot | undefined
  /**
   * Opens the picker: the SDK's popup, or `config.walletPicker`. Rejects on cancel.
   * Idempotent while an attempt is in flight: a second call joins the first.
   */
  connect: () => Promise<void>
  /** Resets `party`, `parties`, `status`, `isLocked` and `lastTx` even if the SDK's own call fails. */
  disconnect: () => Promise<void>
}

const CantonConnectContext = createContext<CantonConnectContextValue | undefined>(undefined)

/** Throws if called outside a `CantonConnectProvider`. */
export const useCantonConnectContext = (): CantonConnectContextValue => {
  const ctx = useContext(CantonConnectContext)
  if (ctx === undefined) {
    throw new Error('canton-connect hooks must be used inside a <CantonConnectProvider>')
  }
  return ctx
}

export interface CantonConnectProviderProps {
  config: CantonConnectConfig
  children: ReactNode
}

type AdapterConfig = Pick<
  CantonConnectConfig,
  'appName' | 'appDescription' | 'appUrl' | 'walletConnectProjectId' | 'additionalAdapters'
>

const buildAdditionalAdapters = (config: AdapterConfig, networkId: string): ProviderAdapter[] => {
  const adapters: ProviderAdapter[] = [...(config.additionalAdapters ?? [])]

  if (config.walletConnectProjectId !== undefined && config.walletConnectProjectId !== '') {
    adapters.push(
      WalletConnectAdapter.create({
        projectId: config.walletConnectProjectId,
        // The CAIP-2 chain the wallet must serve is the configured Canton network id, not the SDK's devnet default.
        chainId: networkId,
        metadata: {
          name: config.appName,
          description: config.appDescription ?? config.appName,
          url: config.appUrl ?? (typeof window === 'undefined' ? '' : window.location.origin),
          icons: [],
        },
      }),
    )
  }

  return adapters
}

/**
 * Owns the connection lifecycle: creates the `DappSDK` from `config`, restores a previous
 * session on mount, and wires wallet-pushed events into the state the hooks read.
 * Those hooks mirror wagmi's naming, not its TanStack Query result shapes.
 */
export const CantonConnectProvider = ({
  config,
  children,
}: CantonConnectProviderProps): JSX.Element => {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [party, setParty] = useState<Party | undefined>(undefined)
  const [parties, setParties] = useState<Party[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const [lastTx, setLastTx] = useState<TxStatusSnapshot | undefined>(undefined)
  const [connectError, setConnectError] = useState<Error | undefined>(undefined)

  const networkId = config.networkId ?? 'canton:local'

  const sdk = useMemo(
    () => new DappSDK(config.walletPicker ? { walletPicker: config.walletPicker } : {}),
    [config.walletPicker],
  )

  const additionalAdapters = useMemo(
    () =>
      buildAdditionalAdapters(
        {
          appName: config.appName,
          appDescription: config.appDescription,
          appUrl: config.appUrl,
          walletConnectProjectId: config.walletConnectProjectId,
          additionalAdapters: config.additionalAdapters,
        },
        networkId,
      ),
    [
      config.appName,
      config.appDescription,
      config.appUrl,
      config.walletConnectProjectId,
      config.additionalAdapters,
      networkId,
    ],
  )

  // A client must exist before wiring; teardownRef shares that wiring between mount-restore and connect().
  const teardownRef = useRef<(() => void) | undefined>(undefined)

  // The initial read and the accountsChanged push are two doors into the same state; one mapping keeps them from drifting.
  const applyAccounts = useCallback(
    (accounts: AccountsChangedEvent): void => {
      const mapped = toParties(accounts, networkId)
      setParties(mapped)
      setParty(mapped[0])
    },
    [networkId],
  )

  const wireEvents = useCallback((): (() => void) => {
    const onAccounts = (accounts: AccountsChangedEvent): void => {
      applyAccounts(accounts)
    }
    const onStatus = (event: StatusEvent): void => {
      setIsLocked(!event.connection.isConnected)
    }
    const onTx = (event: TxChangedEvent): void => {
      setLastTx({
        status: event.status,
        commandId: event.commandId,
        payload: 'payload' in event ? event.payload : undefined,
      })
    }

    void sdk.onAccountsChanged(onAccounts).catch(() => undefined)
    void sdk.onStatusChanged(onStatus).catch(() => undefined)
    void sdk.onTxChanged(onTx).catch(() => undefined)

    return () => {
      void sdk.removeOnAccountsChanged(onAccounts).catch(() => undefined)
      void sdk.removeOnStatusChanged(onStatus).catch(() => undefined)
      void sdk.removeOnTxChanged(onTx).catch(() => undefined)
    }
  }, [sdk, applyAccounts])

  // Shared by mount-restore and a failed connect() that left a live client behind — wires events (unless already wired) and syncs isLocked/status/parties from a status() read.
  const syncFromStatus = useCallback(
    async (restored: StatusEvent): Promise<void> => {
      // Wire events regardless of lock state so a later unlock push isn't dropped silently.
      if (teardownRef.current === undefined) {
        teardownRef.current = wireEvents()
      }

      setIsLocked(!restored.connection.isConnected)
      setStatus('connected')

      if (!restored.connection.isConnected) {
        // Locked — wait for the unlock push.
        setParty(undefined)
        setParties([])
        return
      }

      const accounts = await sdk.listAccounts()
      applyAccounts(accounts)
    },
    [sdk, applyAccounts, wireEvents],
  )

  useEffect(() => {
    let cancelled = false

    // defaultAdapters: [] keeps the SDK's bundled localhost dev gateway out of the picker.
    void sdk.init({ additionalAdapters, defaultAdapters: [] }).then(async () => {
      if (cancelled) return

      // status() throws when there's nothing to restore — that's normal, not an error.
      const restored = await sdk.status().catch(() => undefined)
      if (cancelled || restored === undefined) return

      await syncFromStatus(restored)
    })

    return () => {
      cancelled = true
      teardownRef.current?.()
      teardownRef.current = undefined
    }
  }, [sdk, additionalAdapters, syncFromStatus])

  // The in-flight connect; a second call joins it instead of starting a rival attempt.
  const attemptRef = useRef<Promise<void> | undefined>(undefined)

  const runConnect = useCallback(async (): Promise<void> => {
    setStatus('connecting')
    setConnectError(undefined)

    // Remove listeners from the current client before connect() swaps in a new one.
    teardownRef.current?.()
    teardownRef.current = undefined

    try {
      const result = await sdk.connect() // opens the picker
      if (!result.isConnected) {
        throw new Error(result.reason ?? 'Wallet did not connect')
      }

      teardownRef.current = wireEvents()

      const accounts = await sdk.listAccounts()
      applyAccounts(accounts)

      // connect() only resolves for an unlocked wallet, so clear any lock left by a restored session.
      setIsLocked(false)
      setStatus('connected')
    } catch (err) {
      setConnectError(err as Error)

      // A cancelled picker fails before the SDK swaps its client — probe rather than assume a previous session is gone.
      const restored = await sdk.status().catch(() => undefined)

      if (restored === undefined) {
        setParty(undefined)
        setParties([])
        setIsLocked(false)
        setStatus('disconnected')
      } else {
        await syncFromStatus(restored)
      }

      throw err
    }
  }, [sdk, applyAccounts, wireEvents, syncFromStatus])

  // Not async: an async wrapper re-wraps the shared promise per caller, and a fire-and-forget join would then reject unhandled.
  const connect = useCallback((): Promise<void> => {
    const inFlight = attemptRef.current
    if (inFlight !== undefined) {
      return inFlight
    }

    const attempt = runConnect().finally(() => {
      attemptRef.current = undefined
    })
    attemptRef.current = attempt

    // One handler always attached, so a caller that ignores the promise cannot cause an unhandled rejection.
    void attempt.catch(() => undefined)

    return attempt
  }, [runConnect])

  const disconnect = useCallback(async (): Promise<void> => {
    teardownRef.current?.()
    teardownRef.current = undefined

    await sdk.disconnect().catch(() => undefined)

    setParty(undefined)
    setParties([])
    setStatus('disconnected')
    setIsLocked(false)
    setLastTx(undefined)
  }, [sdk])

  const value = useMemo<CantonConnectContextValue>(
    () => ({
      config,
      sdk,
      party,
      parties,
      status,
      isLocked,
      connectError,
      isConnecting: status === 'connecting',
      lastTx,
      connect,
      disconnect,
    }),
    [config, sdk, party, parties, status, isLocked, connectError, lastTx, connect, disconnect],
  )

  return <CantonConnectContext.Provider value={value}>{children}</CantonConnectContext.Provider>
}
