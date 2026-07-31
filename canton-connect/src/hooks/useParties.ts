import { useCantonConnectContext } from '../CantonConnectProvider'
import type { Party } from '../types'

/** Return value of `useParties`. */
export interface UsePartiesResult {
  parties: Party[]
}

/**
 * Every party the connected wallet holds that can actually act, primary
 * first. Empty while disconnected and while the wallet is locked; parties the
 * wallet reports as not yet on the ledger are left out, so a caller never
 * has to handle one that cannot sign.
 *
 * Use it to build a party switcher. Reach for `useParty` when one party is
 * enough — it returns the same first entry.
 *
 * No wagmi counterpart: wagmi's `useAccount` is single-account by design.
 */
export const useParties = (): UsePartiesResult => {
  const ctx = useCantonConnectContext()
  return { parties: ctx.parties }
}
