import { useSelector } from '@xstate/react'
import { type CantonConnectProvider, useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectionStatus } from '#src/machine/connectionMachine'

/**
 * Return shape of {@link useWalletStatus}: connected-but-locked is a real pair.
 *
 * In CIP-0103 terms, locked is an unauthenticated session: it stands, but the wallet pushed
 * `isConnected: false` and answers no requests until it pushes true again.
 *
 * @category Hooks
 */
export interface UseWalletStatusResult {
  isLocked: boolean
  isConnected: boolean
}

/**
 * Reports the session and lock state from the wallet's own pushes. A wallet that disconnected on
 * its own pushed the same thing as a lock, so `isLocked` cannot tell them apart.
 *
 * @throws with no {@link CantonConnectProvider} above it.
 *
 * @example
 * const { isConnected, isLocked } = useWalletStatus()
 * if (!isConnected) return <p>No session.</p>
 * return isLocked ? <p>Unlock your wallet to continue.</p> : <p>Ready.</p>
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
