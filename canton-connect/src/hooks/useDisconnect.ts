import { useSelector } from '@xstate/react'
import type { CantonConnectProvider } from '#src/CantonConnectProvider'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectionStatus } from '#src/machine/connectionMachine'

/**
 * Return shape of {@link useDisconnect}. `disconnect` settles within 10 s even unanswered.
 *
 * @category Hooks
 */
export interface UseDisconnectResult {
  disconnect: () => Promise<void>
  isPending: boolean
}

/**
 * Disconnects the wallet and reports that transition. No `error`: a disconnect always settles, by
 * the timeout if the wallet never answers.
 *
 * @throws with no {@link CantonConnectProvider} above it, as every hook here does.
 *
 * @example
 * const { disconnect, isPending } = useDisconnect()
 * <button onClick={() => void disconnect()} disabled={isPending}>
 *   Disconnect
 * </button>
 *
 * @category Hooks
 */
export const useDisconnect = (): UseDisconnectResult => {
  const { connection, disconnect } = useCantonConnectContext()

  const status = useSelector(connection, toConnectionStatus)

  return { disconnect, isPending: status === 'disconnecting' }
}
