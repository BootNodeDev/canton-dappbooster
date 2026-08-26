import { useSelector } from '@xstate/react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectionStatus } from '#src/machine/connectionMachine'

/**
 * Return shape of {@link useWalletStatus}. Connected-but-locked is a real pair: a session exists,
 * but the wallet must be unlocked before it will serve a request.
 *
 * @category Hooks
 */
export interface UseWalletStatusResult {
  /**
   * Connected-but-locked: a session exists, but must be unlocked to serve requests. The party and
   * the status are unchanged while locked, because the session is what owns them.
   */
  isLocked: boolean
  isConnected: boolean
}

/**
 * Whether a session exists and whether the wallet is locked. Connected-but-locked is a CIP-0103
 * state wagmi has no equivalent for, and it follows the wallet's own pushes, so never poll it.
 *
 * @throws with no {@link CantonConnectProvider} above it.
 *
 * @example
 * const { isLocked } = useWalletStatus()
 * isLocked && <p>Wallet locked — unlock it to continue.</p>
 *
 * @category Hooks
 */
export const useWalletStatus = (): UseWalletStatusResult => {
  const { connection } = useCantonConnectContext()

  const isLocked = useSelector(connection, (snapshot) => snapshot.hasTag('unauthenticated'))
  const status = useSelector(connection, toConnectionStatus)

  return {
    isLocked,
    isConnected: status === 'connected',
  }
}
