// Display formatting: amount grouping and relative dates. Identifier truncation lives in
// the kit (`truncateIdentifier`, `partyHint`) so every dApp shortens party ids the same way.

const ccFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

// Canton Coin amount, grouped, up to 2 decimals. No unit suffix (callers add `CC`).
export const formatCC = (amount: number): string => ccFormatter.format(amount)

const ccFullFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 })

// Full ledger precision (Decimal is ≤10 dp), grouped, no trailing zeros. Use where
// rounding to 2 dp would mislead — e.g. the exact claimable in a claim dialog.
export const formatCCFull = (amount: number): string => ccFullFormatter.format(amount)

// The exact claimable as a plain numeric string for an amount input. Flooring to 2 dp would strand
// sub-cent residual, and toFixed(10) absorbs float-subtraction noise back to the ledger value.
export const claimAmountInput = (amount: number): string =>
  amount > 0 ? amount.toFixed(10).replace(/\.?0+$/, '') : ''

// Clamp to [0, available] at 10 dp before it reaches the ledger: guards amounts typed beyond
// available and more than 10 decimal places (Canton Decimal is ≤10 dp).
export const clampClaimAmount = (amount: number, available: number): number =>
  Number(Math.min(amount, available).toFixed(10))

export const formatPct = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export const formatDate = (iso: string): string => dateFormatter.format(new Date(iso))

const DAY = 86_400_000

// Human relative distance, e.g. "in 84 days", "in 14 months", "3 days ago".
export const relativeTime = (iso: string, nowMs: number): string => {
  const target = new Date(iso).getTime()
  const diff = target - nowMs
  const abs = Math.abs(diff)
  const days = Math.round(abs / DAY)
  if (days < 1) {
    return 'today'
  }
  let value: string
  if (days < 30) {
    value = `${days} day${days === 1 ? '' : 's'}`
  } else if (days < 365) {
    const months = Math.round(days / 30)
    value = `${months} month${months === 1 ? '' : 's'}`
  } else {
    const years = (days / 365).toFixed(1).replace(/\.0$/, '')
    value = `${years} year${years === '1' ? '' : 's'}`
  }
  return diff >= 0 ? `in ${value}` : `${value} ago`
}
