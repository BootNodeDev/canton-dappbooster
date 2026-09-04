import { useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { type ConnectCancelledError, toConnectError } from '#src/connectError'
import { toConnectionStatus } from '#src/machine/connectionMachine'

/**
 * Return shape of {@link useConnect}.
 *
 * `connect` resolves once the party lands; `cancelConnect` abandons one in flight, rejecting it
 * with {@link ConnectCancelledError}. `disconnect` settles within 10 s; `reset` forgets the error.
 *
 * @category Hooks
 */
export interface UseConnectResult {
  connect: () => Promise<void>
  cancelConnect: () => void
  disconnect: () => Promise<void>
  isConnecting: boolean
  isConnected: boolean
  connectError: Error | undefined
  reset: () => void
}

/**
 * Connects and disconnects the wallet, and reports that transition. `connect` takes no argument:
 * the picker chooses the wallet, so there is no mode to pass. Gate a pending face on
 * `isConnecting` and session-dependent content on `useParty().party`, not on `isConnected`.
 * Wagmi: `useConnect` + `useDisconnect`, bundled because one provider owns the session.
 *
 * @throws with no {@link CantonConnectProvider} above it, as every hook here does.
 *
 * @example
 * const { connect, isConnecting } = useConnect()
 * <button onClick={() => void connect().catch(() => undefined)} disabled={isConnecting}>
 *   Connect
 * </button>
 *
 * @category Hooks
 */
export const useConnect = (): UseConnectResult => {
  const { cancelConnect, connect, connection, disconnect, resetConnectError } =
    useCantonConnectContext()

  const status = useSelector(connection, toConnectionStatus)
  const isConnecting = useSelector(connection, (snapshot) => snapshot.hasTag('connecting'))
  const lastConnectError = useSelector(connection, (snapshot) => snapshot.context.lastConnectError)

  // Classified in a memo rather than in the selector, so one failure keeps one identity: mapping it
  // on every snapshot would hand back a new Error each time, and a consumer comparing it across
  // renders would report the same failure twice.
  const connectError = useMemo(
    () => (lastConnectError === undefined ? undefined : toConnectError(lastConnectError)),
    [lastConnectError],
  )

  return {
    connect,
    cancelConnect,
    disconnect,
    isConnecting,
    isConnected: status === 'connected',
    connectError,
    reset: resetConnectError,
  }
}
