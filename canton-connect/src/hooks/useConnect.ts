import { useConnectKitContext } from '../ConnectKitProvider'

export interface UseConnectResult {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  isConnecting: boolean
  isConnected: boolean
  connectError: Error | undefined
}

export const useConnect = (): UseConnectResult => {
  const ctx = useConnectKitContext()
  return {
    connect: ctx.connect,
    disconnect: ctx.disconnect,
    isConnecting: ctx.isConnecting,
    isConnected: ctx.status === 'connected',
    connectError: ctx.connectError,
  }
}
