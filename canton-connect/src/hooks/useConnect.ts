import { useCantonConnectContext } from '../CantonConnectProvider'

/** Return value of `useConnect`. */
export interface UseConnectResult {
  /**
   * Opens the wallet picker and connects the wallet selected there. Omitting
   * `CantonConnectConfig.walletPicker` opens the SDK's built-in popup.
   */
  connect: () => Promise<void>
  /** Clears the local party and status even if the wallet's own disconnect call fails. */
  disconnect: () => Promise<void>
  isConnecting: boolean
  isConnected: boolean
  connectError: Error | undefined
}

/**
 * Connects and disconnects the wallet, and reports the state of that transition.
 *
 * Wagmi counterpart: `useConnect` plus `useDisconnect` — wagmi splits connect
 * and disconnect into two hooks; this one bundles `disconnect` because a
 * single provider owns the session.
 */
export const useConnect = (): UseConnectResult => {
  const ctx = useCantonConnectContext()
  return {
    connect: ctx.connect,
    disconnect: ctx.disconnect,
    isConnecting: ctx.isConnecting,
    isConnected: ctx.status === 'connected',
    connectError: ctx.connectError,
  }
}
