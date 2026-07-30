import { useCantonConnectContext } from '../CantonConnectProvider'

/** Return value of `useWalletStatus`. */
export interface UseWalletStatusResult {
  isLocked: boolean
  isConnected: boolean
}

/**
 * Whether a wallet is locked or connected. Updates reactively as the wallet
 * pushes status changes, so it never needs to be polled — use it to render
 * "please unlock" UX when a session exists but is locked.
 *
 * No direct wagmi counterpart. The closest is `useAccount().status`, but a
 * wallet that's connected yet locked is a CIP-0103 state wagmi has no
 * equivalent for.
 */
export const useWalletStatus = (): UseWalletStatusResult => {
  const ctx = useCantonConnectContext()
  return {
    isLocked: ctx.isLocked,
    isConnected: ctx.status === 'connected',
  }
}
