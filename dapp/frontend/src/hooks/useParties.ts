import type { PartyRef } from '@/backend/VestingBackend'
import { useWalletContext } from '@/providers/WalletProvider'

export interface UsePartiesResult {
  pool: PartyRef[]
  operator: string
}

// What the party picker needs: who you can act as, and who the operator is.
export const useParties = (): UsePartiesResult => {
  const ctx = useWalletContext()
  return { pool: ctx.pool, operator: ctx.operator }
}
