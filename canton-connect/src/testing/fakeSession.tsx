import type { DappSDK } from '@canton-network/dapp-sdk'
import { type JSX, type ReactNode, useCallback, useMemo, useState } from 'react'
import { CantonConnectContext, type CantonConnectContextValue } from '#src/CantonConnectProvider'
import type { CantonConnectConfig, ConnectionStatus, Party } from '#src/types'

const CONFIG: CantonConnectConfig = { appName: 'fake-session' }

// Anything past the connect flow needs a real wallet; a canned answer would read as one.
const SDK = new Proxy({} as DappSDK, {
  get: (_, key) => {
    throw new Error(`fake session has no sdk.${String(key)} — drive the real provider for that`)
  },
})

/**
 * Props for {@link FakeSessionProvider}. `party` is what a connect resolves to, and omitting it
 * stands for a wallet reporting none; `status` starts the session mid-flight, and its default of
 * `'disconnected'` makes a component's connect face render first.
 *
 * @category Components
 */
export interface FakeSessionProviderProps {
  children: ReactNode
  connectError?: Error
  isLocked?: boolean
  party?: Party
  status?: ConnectionStatus
}

/**
 * Stands in for `CantonConnectProvider` with the session already in a given shape, so a component
 * test asserts on markup without paying the SDK's discovery sleeps or its connect flow. `connect`
 * and `disconnect` move the session, but reach for the real provider plus `createMockAdapter` to
 * test connecting itself — the intermediate states here are not the SDK's.
 *
 * @example
 * render(
 *   <FakeSessionProvider status="connected" party={{ partyId: PARTY, networkId: 'canton:local' }}>
 *     <ConnectButton />
 *   </FakeSessionProvider>,
 * )
 *
 * @category Components
 */
export const FakeSessionProvider = ({
  children,
  connectError,
  isLocked = false,
  party,
  status: initialStatus = 'disconnected',
}: FakeSessionProviderProps): JSX.Element => {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus)

  const connect = useCallback(async (): Promise<void> => {
    setStatus('connected')
  }, [])

  const disconnect = useCallback(async (): Promise<void> => {
    setStatus('disconnected')
  }, [])

  const value = useMemo<CantonConnectContextValue>(
    () => ({
      config: CONFIG,
      sdk: SDK,
      party: status === 'connected' ? party : undefined,
      status,
      isLocked,
      connectError,
      isConnecting: status === 'connecting',
      lastTx: undefined,
      connect,
      disconnect,
    }),
    [status, party, isLocked, connectError, connect, disconnect],
  )

  return <CantonConnectContext.Provider value={value}>{children}</CantonConnectContext.Provider>
}
