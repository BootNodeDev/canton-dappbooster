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
import { selectPrimaryAccount, toParty } from './walletAccount'

/**
 * A snapshot of the transaction lifecycle, mirrored from the SDK's
 * `txChanged` event as a submitted command moves through pending, signed,
 * executed, or failed.
 */
export interface TxStatusSnapshot {
  status: TxChangedEvent['status']
  commandId: TxChangedEvent['commandId']
  payload?: unknown
}

/**
 * The full connection state and actions shared by every hook in this
 * package. Read it via `useCantonConnectContext()`, or through one of the
 * narrower hooks (`useConnect`, `useParty`, etc.) that each pick a slice
 * of it.
 */
export interface CantonConnectContextValue {
  config: CantonConnectConfig
  /**
   * The `DappSDK` instance this provider drives. One per `CantonConnectProvider`,
   * recreated only when `config.walletPicker` changes.
   */
  sdk: DappSDK
  party: Party | undefined
  status: ConnectionStatus
  /**
   * True while the wallet reports connected-but-locked: a session exists
   * but the wallet needs an unlock before it will serve requests.
   */
  isLocked: boolean
  connectError: Error | undefined
  isConnecting: boolean
  lastTx: TxStatusSnapshot | undefined
  /**
   * Opens the wallet picker (the SDK's popup, or `config.walletPicker` when
   * set) and connects the wallet selected there. Rejects if the user cancels
   * or the connection fails.
   */
  connect: () => Promise<void>
  /** Disconnects and resets local state (`party`, `status`, `isLocked`, `lastTx`) even if the underlying SDK call fails. */
  disconnect: () => Promise<void>
}

const CantonConnectContext = createContext<CantonConnectContextValue | undefined>(undefined)

/**
 * Reads the current `CantonConnectContextValue` from context.
 * Throws if called outside a `CantonConnectProvider`.
 */
export const useCantonConnectContext = (): CantonConnectContextValue => {
  const ctx = useContext(CantonConnectContext)
  if (ctx === undefined) {
    throw new Error('canton-connect hooks must be used inside a <CantonConnectProvider>')
  }
  return ctx
}

/** Props for `CantonConnectProvider`. */
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
 * Owns the wallet connection lifecycle for the part of the tree it wraps:
 * creates a `DappSDK` instance from `config`, restores a previous session on
 * mount (no need to call `connect()` again after a page refresh if one
 * exists), and wires wallet-pushed events into the state every hook in this
 * package reads.
 *
 * The hooks reading this context mirror wagmi's naming and decomposition,
 * not its result shapes: wagmi's hooks are TanStack Query mutations
 * (`mutate`/`mutateAsync`/`isPending`/`data`/`status`/`reset`); these resolve
 * plain promises and expose fields like `isSigning`/`isExecuting`/`signature`/`lastTx`.
 */
export const CantonConnectProvider = ({
  config,
  children,
}: CantonConnectProviderProps): JSX.Element => {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [party, setParty] = useState<Party | undefined>(undefined)
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

  const wireEvents = useCallback((): (() => void) => {
    const onAccounts = (accounts: AccountsChangedEvent): void => {
      const primary = selectPrimaryAccount(accounts)
      setParty(primary === undefined ? undefined : toParty(primary, networkId))
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
  }, [sdk, networkId])

  // Shared by mount-restore and a failed connect() that left a live client behind — wires events (unless already wired) and syncs isLocked/status/party from a status() read.
  const syncFromStatus = useCallback(
    async (restored: StatusEvent): Promise<void> => {
      // Wire events regardless of lock state so a later unlock push isn't dropped silently.
      if (teardownRef.current === undefined) {
        teardownRef.current = wireEvents()
      }

      setIsLocked(!restored.connection.isConnected)
      setStatus('connected')

      if (!restored.connection.isConnected) {
        setParty(undefined) // locked — wait for the unlock push
        return
      }

      const accounts = await sdk.listAccounts()
      const primary = selectPrimaryAccount(accounts)
      setParty(primary === undefined ? undefined : toParty(primary, networkId))
    },
    [sdk, networkId, wireEvents],
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

  const connect = useCallback(async (): Promise<void> => {
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
      const primary = selectPrimaryAccount(accounts)
      setParty(primary === undefined ? undefined : toParty(primary, networkId))

      // connect() only resolves for an unlocked wallet, so clear any lock left by a restored session.
      setIsLocked(false)
      setStatus('connected')
    } catch (err) {
      setConnectError(err as Error)

      // A cancelled picker fails before the SDK swaps its client — probe rather than assume a previous session is gone.
      const restored = await sdk.status().catch(() => undefined)

      if (restored === undefined) {
        setParty(undefined)
        setIsLocked(false)
        setStatus('disconnected')
      } else {
        await syncFromStatus(restored)
      }

      throw err
    }
  }, [sdk, networkId, wireEvents, syncFromStatus])

  const disconnect = useCallback(async (): Promise<void> => {
    teardownRef.current?.()
    teardownRef.current = undefined

    await sdk.disconnect().catch(() => undefined)

    setParty(undefined)
    setStatus('disconnected')
    setIsLocked(false)
    setLastTx(undefined)
  }, [sdk])

  const value = useMemo<CantonConnectContextValue>(
    () => ({
      config,
      sdk,
      party,
      status,
      isLocked,
      connectError,
      isConnecting: status === 'connecting',
      lastTx,
      connect,
      disconnect,
    }),
    [config, sdk, party, status, isLocked, connectError, lastTx, connect, disconnect],
  )

  return <CantonConnectContext.Provider value={value}>{children}</CantonConnectContext.Provider>
}
