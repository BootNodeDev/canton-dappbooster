import { useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectError } from '#src/connectError'
import { toConnectionStatus } from '#src/machine/connectionMachine'

/**
 * Return shape of {@link useConnect}. `connect` opens the picker and rejects with
 * {@link ConnectCancelledError} where the user closed it; `connectError` records failures, not a
 * cancel the guard saw. `disconnect` clears party and status even if the wallet never answers.
 *
 * @category Hooks
 */
export interface UseConnectResult {
  /** Resolves once the party has landed; rejects on cancel and on a failed account read. */
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  /**
   * True while connect work is in flight, the account read a restore or an unlock starts
   * included, so it is true with no `connect()` call outstanding.
   */
  isConnecting: boolean
  isConnected: boolean
  connectError: Error | undefined
  /**
   * Forgets `connectError`, for dismissing a message the user has read. It does not disconnect,
   * cancel an attempt in flight, or touch the wallet — same scope as `useExecute().reset()`.
   */
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
  const { connect, connection, disconnect, resetConnectError } = useCantonConnectContext()

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
    disconnect,
    isConnecting,
    isConnected: status === 'connected',
    connectError,
    reset: resetConnectError,
  }
}
