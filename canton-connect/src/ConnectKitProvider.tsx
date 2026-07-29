// ConnectKitProvider owns the wallet connection lifecycle and exposes it
// through React context. Hooks (useConnect, useParty, useSignMessage, etc.)
// are thin readers that subscribe to this context.
//
// Connector dispatch:
//   - mode='extension': injected provider only; throws if not detected
//   - mode='walletconnect': WC fallback; requires walletConnectProjectId
//   - mode='preferred' (default): try extension, fall back to WalletConnect

import type { Provider } from '@canton-network/core-splice-provider'
import type { RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client'
import type { DappClient } from '@canton-network/dapp-sdk'
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
import { createExtensionConnector } from './connectors/extension'
import { createWalletConnectConnector } from './connectors/walletconnect'
import { type RawWalletAccount, selectPrimaryAccount, toParty } from './lib/walletAccount'
import type {
  ConnectionStatus,
  ConnectKitConfig,
  ConnectMode,
  ExtensionConnector,
  Party,
  WalletConnectConnector,
} from './types'

export interface TxStatusSnapshot {
  status: string
  commandId?: string
  payload?: unknown
}

export interface ConnectKitContextValue {
  config: ConnectKitConfig
  client: DappClient | undefined
  party: Party | undefined
  status: ConnectionStatus
  isLocked: boolean
  connectError: Error | undefined
  isConnecting: boolean
  pairingUri: string | undefined
  lastTx: TxStatusSnapshot | undefined
  connect: (mode?: ConnectMode) => Promise<void>
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

export const ConnectKitProvider = ({ config, children }: ConnectKitProviderProps): JSX.Element => {
  const [client, setClient] = useState<DappClient | undefined>(undefined)
  const [party, setParty] = useState<Party | undefined>(undefined)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [isLocked, setIsLocked] = useState(false)
  const [connectError, setConnectError] = useState<Error | undefined>(undefined)
  const [pairingUri, setPairingUri] = useState<string | undefined>(undefined)
  const [lastTx, setLastTx] = useState<TxStatusSnapshot | undefined>(undefined)

  // Hold the live connector providers so we can detach event listeners on
  // disconnect or re-connect without re-creating them.
  const teardownRef = useRef<(() => void) | undefined>(undefined)

  const network = config.network ?? 'canton:local'

  const extensionConnector = useMemo<ExtensionConnector>(
    () => config.extensionConnectorFactory?.() ?? createExtensionConnector(),
    [config.extensionConnectorFactory],
  )

  const buildWalletConnectConnector = useCallback((): WalletConnectConnector => {
    const projectId = config.walletConnectProjectId
    if (projectId === undefined || projectId.trim() === '') {
      throw new Error(
        'walletConnectProjectId is required for the walletconnect connector; set it on <ConnectKitProvider config> or use the extension connector',
      )
    }
    const opts = {
      projectId,
      network,
      metadata: {
        name: config.appName,
        description: config.appDescription ?? config.appName,
        url: config.appUrl ?? (typeof window === 'undefined' ? '' : window.location.origin),
        icons: [],
      },
      onUri: setPairingUri,
    }
    return config.walletConnectConnectorFactory?.(opts) ?? createWalletConnectConnector(opts)
  }, [
    config.walletConnectProjectId,
    config.appName,
    config.appDescription,
    config.appUrl,
    config.walletConnectConnectorFactory,
    network,
  ])

  const wireEvents = useCallback(
    (nextClient: DappClient): (() => void) => {
      const accountsHandler = async (payload: unknown): Promise<void> => {
        const accounts = Array.isArray(payload)
          ? (payload as RawWalletAccount[])
          : ((await nextClient.listAccounts()) as RawWalletAccount[])
        const primary = selectPrimaryAccount(accounts)
        if (primary === undefined) {
          setParty(undefined)
          return
        }
        setParty(toParty(primary, network))
      }
      const txHandler = (payload: unknown): void => {
        if (typeof payload !== 'object' || payload === null) {
          return
        }
        const evt = payload as { status?: unknown; commandId?: unknown; payload?: unknown }
        if (typeof evt.status !== 'string') {
          return
        }
        setLastTx({
          status: evt.status,
          commandId: typeof evt.commandId === 'string' ? evt.commandId : undefined,
          payload: evt.payload,
        })
      }
      const statusHandler = (payload: unknown): void => {
        if (typeof payload !== 'object' || payload === null) {
          return
        }
        const evt = payload as { connection?: { isConnected?: unknown } }
        const connected = evt.connection?.isConnected
        if (typeof connected === 'boolean') {
          setIsLocked(connected === false)
        }
      }
      const connectedHandler = (): void => setIsLocked(false)

      nextClient.onAccountsChanged(accountsHandler)
      nextClient.onTxChanged(txHandler)
      nextClient.onStatusChanged(statusHandler)
      nextClient.onConnected(connectedHandler)
      return () => {
        nextClient.removeOnAccountsChanged(accountsHandler)
        nextClient.removeOnTxChanged(txHandler)
        nextClient.removeOnStatusChanged(statusHandler)
        nextClient.removeOnConnected(connectedHandler)
      }
    },
    [network],
  )

  const connect = useCallback(
    async (mode: ConnectMode = 'preferred'): Promise<void> => {
      if (status === 'connecting') {
        return
      }
      setStatus('connecting')
      setConnectError(undefined)
      setPairingUri(undefined)
      try {
        const selected =
          mode === 'walletconnect'
            ? await buildWalletConnectConnector().connect()
            : await (async () => {
                if (await extensionConnector.detect()) {
                  return await extensionConnector.connect()
                }
                if (mode === 'extension') {
                  throw new Error('Carpincho extension was not detected')
                }
                return await buildWalletConnectConnector().connect()
              })()
        const { DappClient } = await import('@canton-network/dapp-sdk')
        const nextClient = new DappClient(selected.provider as Provider<DappRpcTypes>, {
          providerType: selected.providerType,
        })
        const connection = await nextClient.connect()
        if (!connection.isConnected) {
          throw new Error(connection.reason ?? 'Wallet did not connect')
        }
        const accounts = (await nextClient.listAccounts()) as RawWalletAccount[]
        const primary = selectPrimaryAccount(accounts)
        if (primary === undefined) {
          await nextClient.disconnect().catch(() => undefined)
          throw new Error('Wallet connected without accounts')
        }
        teardownRef.current = wireEvents(nextClient)
        setClient(nextClient)
        setParty(toParty(primary, network))
        setIsLocked(false)
        setStatus('connected')
        setPairingUri(undefined)
      } catch (err) {
        const error = err as Error
        setConnectError(error)
        setStatus('disconnected')
        throw error
      }
    },
    [status, extensionConnector, buildWalletConnectConnector, wireEvents, network],
  )

  const disconnect = useCallback(async (): Promise<void> => {
    const current = client
    // Tear down React state synchronously so a hung wallet cannot trap the
    // consumer in a busy state. The async disconnect runs in the background.
    teardownRef.current?.()
    teardownRef.current = undefined
    setClient(undefined)
    setParty(undefined)
    setStatus('disconnected')
    setIsLocked(false)
    setPairingUri(undefined)
    setLastTx(undefined)
    setConnectError(undefined)
    if (current !== undefined) {
      await current.disconnect().catch(() => undefined)
    }
  }, [client])

  useEffect(
    () => () => {
      teardownRef.current?.()
    },
    [],
  )

  const value = useMemo<ConnectKitContextValue>(
    () => ({
      config,
      client,
      party,
      status,
      isLocked,
      connectError,
      isConnecting: status === 'connecting',
      pairingUri,
      lastTx,
      connect,
      disconnect,
    }),
    [
      config,
      client,
      party,
      status,
      isLocked,
      connectError,
      pairingUri,
      lastTx,
      connect,
      disconnect,
    ],
  )

  return <ConnectKitContext.Provider value={value}>{children}</ConnectKitContext.Provider>
}
