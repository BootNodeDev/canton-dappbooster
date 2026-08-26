import { type JSX, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { createActor, type StateValue } from 'xstate'
import { CantonConnectContext } from '#src/CantonConnectProvider'
import { type ConnectionActorRef, connectionMachine } from '#src/machine/connectionMachine'
import { connectionInput } from '#src/testing/connectionInput'
import type {
  CantonConnectConfig,
  CantonConnectContextValue,
  ConnectionStatus,
  Party,
  WalletSdk,
} from '#src/types'

const CONFIG: CantonConnectConfig = { appName: 'fake-session' }

// Module scope so an omitted prop keeps its identity across renders, which is what stops the
// session from being rebuilt on every one.
const NO_SDK: Partial<WalletSdk> = {}

// Anything past the connect flow needs a real wallet; a canned answer would read as one. Safe as
// machine context because a rehydrated snapshot carries no children, so no actor reaches for it.
/** A `sdk` wrapper that throws naming the method for anything the test never stubbed. */
const refusingSdk = (supplied: Partial<WalletSdk>): WalletSdk =>
  new Proxy({} as WalletSdk, {
    get: (_, key) => {
      const method = supplied[key as keyof WalletSdk]

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
  party: Party | undefined,
  connectError: Error | undefined,
  sdk: WalletSdk,
): ConnectionActorRef => {
  const input = connectionInput({}, { createSdk: () => sdk })

  const snapshot = connectionMachine.resolveState({
    value: toStateValue(shape),
    context: {
      ...input,
      sdk,
      lastConnectError: connectError,
      // The machine clears it on leaving `session`, so a party outside one cannot be published.
      party: shape.status === 'connected' ? party : undefined,
    },
  })

  return createActor(connectionMachine, { input, snapshot }).start()
}

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
  /** Only alongside `status="connected"`: a lock is a session that has to be unlocked. */
  isLocked?: boolean
  party?: Party
  /**
   * The accounts read a session starts, which counts as connecting: this is how a consumer test
   * reaches the pending face over a live session. Only alongside `status="connected"`.
   */
  readingAccounts?: boolean
  /**
   * The `sdk` methods this session answers; every other one refuses, as all of them do by default.
   * For driving a hook's own pending flag, captured error and `reset()`, never for asserting what
   * a wallet returns: a canned answer is indistinguishable from a real one.
   */
  sdk?: Partial<WalletSdk>
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
  readingAccounts = false,
  sdk = NO_SDK,
  status: initialStatus = 'disconnected',
}: FakeSessionProviderProps): JSX.Element => {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus)

  // Rebuilt from the props rather than moved by events, so the double stays declarative: a state
  // it can name is a state a test can ask for, in one step and with no actor to drive.
  const connection = useMemo(
    () =>
      startSession({ isLocked, readingAccounts, status }, party, connectError, refusingSdk(sdk)),
    [connectError, isLocked, party, readingAccounts, sdk, status],
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
      disconnect,
      resetConnectError: () => connection.send({ type: 'connectError.reset' }),
    }),
    [connection, connect, disconnect],
  )

  return <CantonConnectContext.Provider value={value}>{children}</CantonConnectContext.Provider>
}
