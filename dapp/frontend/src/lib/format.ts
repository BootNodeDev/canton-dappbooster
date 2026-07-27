// Display formatting. Amounts and party ids render in JetBrains Mono (see tokens);
// these helpers handle grouping, truncation, and relative dates.

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

// The exact claimable as a plain numeric string for an amount input. Flooring to 2 dp
// strands sub-cent residual (you could never claim it all), so fill the full remaining;
// toFixed(10) also absorbs float-subtraction noise back to the ledger value.
export const claimAmountInput = (amount: number): string =>
  amount > 0 ? amount.toFixed(10).replace(/\.?0+$/, '') : ''

// Clamp the user-supplied amount to [0, available] at 10 dp precision before it
// reaches the ledger. Guards against: amounts typed beyond available (float drift or
// user error) and more than 10 decimal places (Canton Decimal is ≤10 dp).
export const clampClaimAmount = (amount: number, available: number): number =>
  Number(Math.min(amount, available).toFixed(10))

export const formatPct = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`

// A Canton party id is `hint::fingerprint`. Show the readable hint plus a short
// fingerprint tail, e.g. `alice::1220…c4d1`.
export const shortenParty = (partyId: string): string => {
  const [hint, fingerprint] = partyId.split('::')
  if (fingerprint === undefined) {
    return hint.length > 14 ? `${hint.slice(0, 6)}…${hint.slice(-4)}` : hint
  }
  return `${hint}::${fingerprint.slice(0, 4)}…${fingerprint.slice(-4)}`
}

export const partyHint = (partyId: string): string => partyId.split('::')[0]

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
  let value: string
  if (days < 1) {
    value = 'today'
    return value
  }
  if (days < 45) {
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
