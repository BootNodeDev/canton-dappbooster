import { PARTY } from '@/mock/seed'
import type { PartyId } from '@/store/types'

// A Canton balance is a set of holding contracts, not a scalar, and CIP-0056 v1 coexists with
// CIP-0112 v2. Mocking it as one number would teach the wrong shape.
export interface Holding {
  cid: string
  amount: string
  standard: 'cip-0056' | 'cip-0112'
}

const MOCK_HOLDINGS: Record<PartyId, Holding[]> = {
  [PARTY.alice]: [
    { cid: 'hold-alice-1', amount: '1250000', standard: 'cip-0056' },
    { cid: 'hold-alice-2', amount: '250.5', standard: 'cip-0112' },
  ],
  [PARTY.bob]: [{ cid: 'hold-bob-1', amount: '8421337.1234567891', standard: 'cip-0056' }],
  [PARTY.carol]: [
    { cid: 'hold-carol-1', amount: '640000', standard: 'cip-0056' },
    { cid: 'hold-carol-2', amount: '0.0000000001', standard: 'cip-0056' },
  ],
  [PARTY.dave]: [{ cid: 'hold-dave-1', amount: '96500.25', standard: 'cip-0112' }],
}

/**
 * The whole simulated read, delay included, so swapping in a real one replaces this function and
 * leaves the hook above it alone. Delayed so the loading path shows on every party switch, not only
 * against a ledger. Resolves `undefined` for a party with no record at all.
 */
export const readHoldings = (partyId: PartyId): Promise<Holding[] | undefined> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_HOLDINGS[partyId]), 400)
  })
