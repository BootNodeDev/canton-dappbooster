import type { InstrumentId } from '#src/providers/TokenListProvider/context'
import { formatScaled, parseAmount } from '#src/utils/tokenAmount'
import { tokenKey } from '#src/utils/tokenKey'

/**
 * One holding contract a party owns, as {@link useHoldings} reports it. A locked one is escrowed,
 * which is why the two are summed apart.
 *
 * @example
 * const spendable = holdings.filter((holding) => !holding.isLocked)
 *
 * @category Utilities
 */
export interface Holding {
  amount: string
  instrumentId: InstrumentId
  isLocked: boolean
}

/**
 * What a party holds of one instrument: `balance` is spendable, `locked` is escrowed.
 *
 * @example
 * const [{ balance, locked }] = sumHoldings(holdings)
 *
 * @category Utilities
 */
export interface InstrumentBalance {
  balance: string
  instrumentId: InstrumentId
  locked: string
}

interface Running {
  balance: bigint
  instrumentId: InstrumentId
  locked: bigint
}

/**
 * Groups a holdings read by instrument and sums it, spendable apart from locked.
 *
 * @example
 * sumHoldings([{ amount: '1.5', instrumentId, isLocked: false }])
 * // [{ balance: '1.5', instrumentId, locked: '0' }]
 *
 * @category Utilities
 */
export const sumHoldings = (holdings: readonly Holding[]): readonly InstrumentBalance[] => {
  const totals = new Map<string, Running>()

  for (const { amount, instrumentId, isLocked } of holdings) {
    // A ledger amount is `Numeric 10` and always parses, so this only drops one from a read that
    // is already broken.
    const scaled = parseAmount(amount)

    if (scaled === undefined) continue

    const key = tokenKey(instrumentId)
    const at = totals.get(key) ?? { balance: 0n, instrumentId, locked: 0n }
    totals.set(
      key,
      isLocked ? { ...at, locked: at.locked + scaled } : { ...at, balance: at.balance + scaled },
    )
  }

  return [...totals.values()].map(({ balance, instrumentId, locked }) => ({
    balance: formatScaled(balance),
    instrumentId,
    locked: formatScaled(locked),
  }))
}
