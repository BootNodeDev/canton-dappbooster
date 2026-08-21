import { useCantonConnectContext } from '#src/CantonConnectProvider'

/**
 * Return shape of {@link useConnect}. `connect` opens the picker and rejects with
 * {@link ConnectCancelledError} where the user closed it, which `connectError` mirrors;
 * `disconnect` clears the local party and status even if the wallet's own call fails.
 *
 * @category Hooks
 */
export interface UseConnectResult {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  isConnecting: boolean
  isConnected: boolean
  connectError: Error | undefined
}

/**
 * Connects and disconnects the wallet, and reports that transition. `connect` takes no argument:
 * the picker chooses the wallet, so there is no mode to pass.
 * Wagmi: `useConnect` + `useDisconnect`, bundled because one provider owns the session.
 *
 * @throws with no {@link CantonConnectProvider} above it, as every hook here does.
 *
 * @example
 * const { connect, isConnecting } = useConnect()
 * <button onClick={() => void connect().catch(() => undefined)} disabled={isConnecting}>
 *   Connect
 * </button>
 *
 * @category Hooks
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
