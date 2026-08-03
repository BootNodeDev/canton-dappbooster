import { useCantonConnectContext } from '../CantonConnectProvider'

export interface UseWalletStatusResult {
  isLocked: boolean
  isConnected: boolean
}

/**
 * Connected-but-locked is a CIP-0103 state wagmi has no equivalent for;
 * updates reactively, never poll it.
 */
export const useWalletStatus = (): UseWalletStatusResult => {
  const ctx = useCantonConnectContext()
  return {
    isLocked: ctx.isLocked,
    isConnected: ctx.status === 'connected',
  }
}
