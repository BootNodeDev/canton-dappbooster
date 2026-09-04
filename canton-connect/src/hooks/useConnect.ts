import { useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { type ConnectCancelledError, toConnectError } from '#src/connectError'
import { toConnectionStatus } from '#src/machine/connectionMachine'

/**
 * Return shape of {@link useConnect}.
 *
 * `connect` resolves once the party lands and rejects a cancel with {@link ConnectCancelledError}.
 * `reset` forgets only `error`.
 *
 * @category Hooks
 */
export interface UseConnectResult {
  connect: () => Promise<void>
  isPending: boolean
  isConnected: boolean
  error: Error | undefined
  reset: () => void
}

/**
 * Connects the wallet and reports that transition. `connect` takes no argument: the picker chooses
 * the wallet, so there is no mode to pass. Gate a pending face on `isPending` and
 * session-dependent content on `useParty().party`, not on `isConnected`.
 *
 * @throws with no {@link CantonConnectProvider} above it, as every hook here does.
 *
 * @example
 * const { connect, isPending } = useConnect()
 * <button onClick={() => void connect().catch(() => undefined)} disabled={isPending}>
 *   Connect
 * </button>
 *
 * @category Hooks
 */
export const useConnect = (): UseConnectResult => {
  const { connect, connection, resetConnectError } = useCantonConnectContext()

  const status = useSelector(connection, toConnectionStatus)
  const isPending = useSelector(connection, (snapshot) => snapshot.hasTag('connecting'))
  const lastConnectError = useSelector(connection, (snapshot) => snapshot.context.lastConnectError)

  // Classified in a memo rather than in the selector, so one failure keeps one identity: mapping it
  // on every snapshot would hand back a new Error each time, and a consumer comparing it across
  // renders would report the same failure twice.
  const error = useMemo(
    () => (lastConnectError === undefined ? undefined : toConnectError(lastConnectError)),
    [lastConnectError],
  )

  return {
    connect,
    isPending,
    isConnected: status === 'connected',
    error,
    reset: resetConnectError,
  }
}
