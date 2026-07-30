// ConnectKitProvider owns the wallet connection lifecycle and exposes it
// through React context. Hooks (useConnect, useParty, useSignMessage, etc.)
// are thin readers that subscribe to this context.

import type {
  AccountsChangedEvent,
  ProviderAdapter,
  StatusEvent,
  TxChangedEvent,
} from '@canton-network/dapp-sdk'
import { DappSDK } from '@canton-network/dapp-sdk'
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
import { selectPrimaryAccount, toParty } from './lib/walletAccount'
import type { ConnectionStatus, ConnectKitConfig, Party } from './types'

export interface TxStatusSnapshot {
  status: string
  commandId?: string
  payload?: unknown
}

export interface ConnectKitContextValue {
  config: ConnectKitConfig
  sdk: DappSDK
  party: Party | undefined
  status: ConnectionStatus
  isLocked: boolean
  connectError: Error | undefined
  isConnecting: boolean
  lastTx: TxStatusSnapshot | undefined
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const ConnectKitContext = createContext<ConnectKitContextValue | undefined>(undefined)

export const useConnectKitContext = (): ConnectKitContextValue => {
  const ctx = useContext(ConnectKitContext)
  if (ctx === undefined) {
    throw new Error('useConnectKit* hooks must be used inside a <ConnectKitProvider>')
  }
  return ctx
}

export interface ConnectKitProviderProps {
  config: ConnectKitConfig
  children: ReactNode
}

// Seam for the WalletConnect adapter (#4) and mock adapter (#7); both land as later tasks.
const buildAdditionalAdapters = (
  additionalAdapters: ProviderAdapter[] | undefined,
): ProviderAdapter[] => additionalAdapters ?? []

export const ConnectKitProvider = ({ config, children }: ConnectKitProviderProps): JSX.Element => {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [party, setParty] = useState<Party | undefined>(undefined)
  const [isLocked, setIsLocked] = useState(false)
  const [lastTx, setLastTx] = useState<TxStatusSnapshot | undefined>(undefined)
  const [connectError, setConnectError] = useState<Error | undefined>(undefined)

  const network = config.network ?? 'canton:local'

  const sdk = useMemo(
    () => new DappSDK(config.walletPicker ? { walletPicker: config.walletPicker } : {}),
    [config.walletPicker],
  )

  const additionalAdapters = useMemo(
    () => buildAdditionalAdapters(config.additionalAdapters),
    [config.additionalAdapters],
  )

  // A client must exist before wiring; teardownRef shares that wiring between mount-restore and connect().
  const teardownRef = useRef<(() => void) | undefined>(undefined)

  const wireEvents = useCallback((): (() => void) => {
    const onAccounts = (accounts: AccountsChangedEvent): void => {
      const primary = selectPrimaryAccount(accounts)
      setParty(primary === undefined ? undefined : toParty(primary, network))
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

    void sdk.onAccountsChanged(onAccounts)
    void sdk.onStatusChanged(onStatus)
    void sdk.onTxChanged(onTx)

    return () => {
      void sdk.removeOnAccountsChanged(onAccounts).catch(() => undefined)
      void sdk.removeOnStatusChanged(onStatus).catch(() => undefined)
      void sdk.removeOnTxChanged(onTx).catch(() => undefined)
    }
  }, [sdk, network])

  useEffect(() => {
    let cancelled = false

    // defaultAdapters: [] keeps the SDK's bundled localhost dev gateway out of the picker.
    void sdk.init({ additionalAdapters, defaultAdapters: [] }).then(async () => {
      if (cancelled) return

      // status() throws when there's nothing to restore — that's normal, not an error.
      const restored = await sdk.status().catch(() => undefined)
      if (cancelled || restored === undefined) return

      // Wire events regardless of lock state so a later unlock push isn't dropped silently.
      teardownRef.current = wireEvents()
      setIsLocked(!restored.connection.isConnected)
      setStatus('connected')

      if (!restored.connection.isConnected) return // locked — wait for the unlock push

      const accounts = await sdk.listAccounts()
      const primary = selectPrimaryAccount(accounts)
      setParty(primary === undefined ? undefined : toParty(primary, network))
    })

    return () => {
      cancelled = true
      teardownRef.current?.()
      teardownRef.current = undefined
    }
  }, [sdk, additionalAdapters, network, wireEvents])

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
      setParty(primary === undefined ? undefined : toParty(primary, network))
      setStatus('connected')
    } catch (err) {
      setConnectError(err as Error)
      setStatus('disconnected')
      throw err
    }
  }, [sdk, network, wireEvents])

  const disconnect = useCallback(async (): Promise<void> => {
    teardownRef.current?.()
    teardownRef.current = undefined

    await sdk.disconnect().catch(() => undefined)

    setParty(undefined)
    setStatus('disconnected')
    setIsLocked(false)
    setLastTx(undefined)
  }, [sdk])

  const value = useMemo<ConnectKitContextValue>(
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

  return <ConnectKitContext.Provider value={value}>{children}</ConnectKitContext.Provider>
}
