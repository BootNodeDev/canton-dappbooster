import type { PartyRef } from '@/backend/VestingBackend'
import { useWalletContext } from '@/providers/WalletProvider'

export interface UsePartyResult {
  party: PartyRef | undefined
  isConnected: boolean
}

export const useParty = (): UsePartyResult => {
  const ctx = useWalletContext()
  return { party: ctx.party, isConnected: ctx.isConnected }
}
