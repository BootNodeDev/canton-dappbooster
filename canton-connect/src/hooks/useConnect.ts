import { useCantonConnectContext } from '../CantonConnectProvider'

export interface UseConnectResult {
  /** Opens the picker and connects the chosen wallet. Idempotent while an attempt is in flight. */
  connect: () => Promise<void>
  /**
   * Cancels any pending wallet choice, settles an in-flight `connect()` (even one the
   * wallet would never answer), then clears the local party, status, and any connect
   * error even if the wallet's own disconnect call fails.
   */
  disconnect: () => Promise<void>
  isConnecting: boolean
  isConnected: boolean
  connectError: Error | undefined
}

/**
 * Connects and disconnects the wallet, and reports that transition.
 * Wagmi: `useConnect` + `useDisconnect`, bundled because one provider owns the session.
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
