import { type JSX, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { createActor, type StateValue } from 'xstate'
import { CantonConnectContext } from '#src/CantonConnectProvider'
import { type ConnectionActorRef, connectionMachine } from '#src/machine/connectionMachine'
import { connectionInput } from '#src/testing/connectionInput'
import type {
  Account,
  CantonConnectConfig,
  CantonConnectContextValue,
  ConnectionStatus,
  DappSdkMethods,
} from '#src/types'

const CONFIG: CantonConnectConfig = { appName: 'fake-session' }

// Module scope so an omitted prop keeps its identity across renders, which is what stops the
// session from being rebuilt on every one.
const NO_SDK: Partial<DappSdkMethods> = {}

// Anything past the connect flow needs a real wallet; a canned answer would read as one. Safe as
// machine context because a rehydrated snapshot carries no children, so no actor reaches for it.
/** A `sdk` wrapper that throws naming the method for anything the test never stubbed. */
const refusingSdk = (supplied: Partial<DappSdkMethods>): DappSdkMethods =>
  new Proxy({} as DappSdkMethods, {
    get: (_, key) => {
      const method = supplied[key as keyof DappSdkMethods]

      if (method === undefined) {
        throw new Error(`fake session has no sdk.${String(key)} — drive the real provider for that`)
      }

      return method
    },
  })

/** The session a test asks for, before it is turned into a machine state. */
type SessionShape = {
  isLocked: boolean
  readingAccounts: boolean
  status: ConnectionStatus
}

// State names outside the machine, which only a double gets to hold: pinning states is its whole
// job, and every state it names is one the SDK would otherwise have to be driven into.
/** Turns a `SessionShape` into the state value the real machine would hold for it. */
const toStateValue = ({ isLocked, readingAccounts, status }: SessionShape): StateValue => {
  if (status !== 'connected') {
    return status
  }

  if (isLocked) {
    return { session: 'unauthenticated' }
  }

  return { session: { authenticated: readingAccounts ? 'reading' : 'ready' } }
}

/** Starts a real `connectionMachine` actor rehydrated at the given `SessionShape`. */
const startSession = (
  shape: SessionShape,
  account: Account | undefined,
  connectError: Error | undefined,
  sdk: DappSdkMethods,
): ConnectionActorRef => {
  const input = connectionInput({}, { createSdk: () => sdk })

  const snapshot = connectionMachine.resolveState({
    value: toStateValue(shape),
    context: {
      ...input,
      sdk,
      lastConnectError: connectError,
      // The machine clears it on leaving `session`, so an account outside one cannot be published.
      account: shape.status === 'connected' ? account : undefined,
    },
  })

  return createActor(connectionMachine, { input, snapshot }).start()
}

/**
 * Props for {@link FakeSessionProvider}. `status` starts the session mid-flight and `account` is
 * what a connect resolves to; `readingAccounts` reaches the pending face over a live session, and
 * `sdk` drives a hook's own pending, error and `reset()`, never what a wallet returns.
 *
 * @category Components
 */
export interface FakeSessionProviderProps {
  account?: Account
  children: ReactNode
  connectError?: Error
  isLocked?: boolean
  readingAccounts?: boolean
  sdk?: Partial<DappSdkMethods>
  status?: ConnectionStatus
}

/**
 * Stands in for `CantonConnectProvider` with the session already in a given shape, so a component
 * test asserts on markup without paying the SDK's discovery sleeps or its connect flow. The shape
 * is a real `connectionMachine` actor rehydrated at the state the props ask for, so the hooks
 * select from it exactly as they do in the app. `connect` and `disconnect` move the session, but
 * reach for the real provider plus `createMockAdapter` to test connecting itself — the intermediate
 * states here are not the SDK's.
 *
 * @example
 * render(
 *   <FakeSessionProvider status="connected" account={account}>
 *     <ConnectButton />
 *   </FakeSessionProvider>,
 * )
 *
 * @category Components
 */
export const FakeSessionProvider = ({
  account,
  children,
  connectError,
  isLocked = false,
  readingAccounts = false,
  sdk = NO_SDK,
  status: initialStatus = 'disconnected',
}: FakeSessionProviderProps): JSX.Element => {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus)

  // Rebuilt from the props rather than moved by events, so the double stays declarative: a state
  // it can name is a state a test can ask for, in one step and with no actor to drive.
  const connection = useMemo(
    () =>
      startSession({ isLocked, readingAccounts, status }, account, connectError, refusingSdk(sdk)),
    [account, connectError, isLocked, readingAccounts, sdk, status],
  )

  useEffect(() => () => connection.stop(), [connection])

  const connect = useCallback(async (): Promise<void> => {
    setStatus('connected')
  }, [])

  const disconnect = useCallback(async (): Promise<void> => {
    setStatus('disconnected')
  }, [])

  const value = useMemo<CantonConnectContextValue>(
    () => ({
      config: CONFIG,
      connection,
      connect,
      cancelConnect: () => connection.send({ type: 'connect.cancel' }),
      disconnect,
      resetConnectError: () => connection.send({ type: 'connectError.reset' }),
    }),
    [connection, connect, disconnect],
  )

  return <CantonConnectContext.Provider value={value}>{children}</CantonConnectContext.Provider>
}
