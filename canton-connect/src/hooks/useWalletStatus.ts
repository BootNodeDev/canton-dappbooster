import { useConnectKitContext } from '../ConnectKitProvider'

export interface UseWalletStatusResult {
  isLocked: boolean
  isConnected: boolean
}

export const useWalletStatus = (): UseWalletStatusResult => {
  const ctx = useConnectKitContext()
  return {
    isLocked: ctx.isLocked,
    isConnected: ctx.status === 'connected',
  }
}
