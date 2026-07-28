import { useConnectKitContext } from '../ConnectKitProvider'

export interface UseWalletStatusResult {
  isLocked: boolean
  isConnected: boolean
}

// Reactive view of the wallet's lock state, driven by the `statusChanged`
// and `connected` events the provider wires through. Use this to render
// "wallet locked, please unlock" UX without polling.
export const useWalletStatus = (): UseWalletStatusResult => {
  const ctx = useConnectKitContext()
  return {
    isLocked: ctx.isLocked,
    isConnected: ctx.status === 'connected',
  }
}
