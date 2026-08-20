import { useCantonConnectContext } from '#src/CantonConnectProvider'

export interface UseConnectResult {
  connect: () => Promise<void>
  /** Clears the local party and status even if the wallet's own disconnect call fails. */
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
