import { useCantonConnectContext } from '../CantonConnectProvider'
import type { Party } from '../types'

export interface UsePartiesResult {
  parties: Party[]
}

/**
 * Every usable party the wallet holds, primary first; empty while locked or disconnected.
 * No wagmi counterpart: `useAccount` is single-account by design.
 */
export const useParties = (): UsePartiesResult => {
  const ctx = useCantonConnectContext()
  return { parties: ctx.parties }
}
