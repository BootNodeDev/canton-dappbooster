import { useCantonConnectContext } from '#src/CantonConnectProvider'

/**
 * Return shape of {@link useWalletStatus}. Connected-but-locked is a real pair: a session exists,
 * but the wallet must be unlocked before it will serve a request.
 *
 * @category Hooks
 */
export interface UseWalletStatusResult {
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
  const ctx = useCantonConnectContext()
  return {
    isLocked: ctx.isLocked,
    isConnected: ctx.status === 'connected',
  }
}
