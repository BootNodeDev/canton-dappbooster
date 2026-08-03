import { useCantonConnectContext } from '../CantonConnectProvider'

export interface UseWalletStatusResult {
  isLocked: boolean
  isConnected: boolean
}

export const useWalletStatus = (): UseWalletStatusResult => {
  const ctx = useCantonConnectContext()
  return {
    isLocked: ctx.isLocked,
    isConnected: ctx.status === 'connected',
  }
}
