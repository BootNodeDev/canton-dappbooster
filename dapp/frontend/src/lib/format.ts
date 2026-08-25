// Display formatting: amount grouping and relative dates. Identifier truncation lives in
// the kit (`truncateIdentifier`, `partyHint`) so every dApp shortens party ids the same way.

import { formatAmount } from '@bootnodedev/canton-dappbooster'
import { roundAmount } from '@/lib/amount'

// `Intl.NumberFormat.format` is typed for `number | bigint`, not the decimal strings amounts are
// here — the kit's `formatAmount` groups the integer part via `BigInt` and carries the fraction as
// text instead, which is exact where a float would round-trip through IEEE 754 first.

// Canton Coin amount, grouped, up to 2 decimals. No unit suffix (callers add `CC`).
export const formatCC = (amount: string): string => formatAmount(roundAmount(amount, 2))

// Full ledger precision, grouped, no trailing zeros.
export const formatCCFull = (amount: string): string => formatAmount(roundAmount(amount, 10))

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
