import { useConnectKitContext } from '../ConnectKitProvider'
import type { ConnectMode } from '../types'

export interface UseConnectResult {
  connect: (mode?: ConnectMode) => Promise<void>
  disconnect: () => Promise<void>
  isConnecting: boolean
  isConnected: boolean
  connectError: Error | undefined
  pairingUri: string | undefined
}

export const useConnect = (): UseConnectResult => {
  const ctx = useConnectKitContext()
  return {
    connect: ctx.connect,
    disconnect: ctx.disconnect,
    isConnecting: ctx.isConnecting,
    isConnected: ctx.status === 'connected',
    connectError: ctx.connectError,
    pairingUri: ctx.pairingUri,
  }
}
