import { addAmounts, isAmount } from '@/lib/amount'

// A Canton balance is a set of holding contracts, not a scalar, and CIP-0056 v1 coexists with
// CIP-0112 v2. Reporting it as one number would teach the wrong shape.
export interface Holding {
  cid: string
  amount: string
  standard: 'cip-0056' | 'cip-0112'
}

// Placeholder amounts: vesting-lite moves no holding, so there is no CC balance on the ledger to
// read yet. One holding carries more decimals than a double survives, so the exact-decimal path
// stays exercised in the UI.
const HOLDINGS: Holding[] = [
  { cid: 'hold-1', amount: '8421337.1234567891', standard: 'cip-0056' },
  { cid: 'hold-2', amount: '250.5', standard: 'cip-0112' },
]

// The whole simulated read, delay included, so a real one replaces this function and leaves the
// hook above it alone. Delayed so the loading path shows on every party switch.
export const readHoldings = (): Promise<Holding[]> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(HOLDINGS), 400)
  })

// An unparseable holding throws rather than folding to zero — a malformed or mis-scaled read would
// otherwise silently understate the total while still listing the bad holding.
export const sumHoldings = (holdings: Holding[]): string => {
  for (const holding of holdings) {
    if (!isAmount(holding.amount)) {
      throw new Error(`Holding ${holding.cid} has an unparseable amount: ${holding.amount}`)
    }
  }
  return addAmounts(...holdings.map((holding) => holding.amount))
}
