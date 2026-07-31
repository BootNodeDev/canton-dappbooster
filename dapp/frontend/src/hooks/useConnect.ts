import type { PartyRef } from '@/backend/VestingBackend'
import { useWalletContext } from '@/providers/WalletProvider'

export interface UseConnectResult {
  connect: (party: PartyRef) => void
  disconnect: () => void
}

export const useConnect = (): UseConnectResult => {
  const ctx = useWalletContext()
  return { connect: ctx.connect, disconnect: ctx.disconnect }
}
