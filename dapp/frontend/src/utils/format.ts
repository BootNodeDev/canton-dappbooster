// Display formatting: amount grouping and relative dates. Identifier truncation lives in
// the kit (`truncateIdentifier`, `partyHint`) so every dApp shortens party ids the same way.

import { formatAmount } from '@bootnodedev/canton-dappbooster'
import { roundAmount } from '@/utils/amount'

// `Intl.NumberFormat.format` is typed for `number | bigint`, not the decimal strings amounts are
// here — the kit's `formatAmount` groups the integer part via `BigInt` and carries the fraction as
// text instead, which is exact where a float would round-trip through IEEE 754 first.

// Canton Coin amount, grouped, always 2 decimals: rounding drops trailing zeros, and a bare `0`
// beside `2,134.78` reads as a different kind of figure. No unit suffix (callers add `CC`).
export const formatCC = (amount: string): string => {
  const [int, frac = ''] = roundAmount(amount, 2).split('.')
  return formatAmount(`${int}.${frac.padEnd(2, '0')}`)
}

// Full ledger precision, grouped, no trailing zeros.
export const formatCCFull = (amount: string): string => formatAmount(roundAmount(amount, 10))

const COMPACT_FROM = 1e4

const UNITS = [
  { min: 1e12, divisor: 1e12, suffix: 'T' },
  { min: 1e9, divisor: 1e9, suffix: 'B' },
  { min: 1e6, divisor: 1e6, suffix: 'M' },
  { min: COMPACT_FROM, divisor: 1e3, suffix: 'K' },
]

// Headline figures, where ten digits are unreadable at a glance. Exact below 10,000, so an ordinary
// grant keeps every digit and only the outsized ones are abbreviated. A float is safe here because
// the result is deliberately approximate; anything submitted or compared uses the decimal string.
export const formatCCCompact = (amount: string): string => {
  const value = Number(amount)
  const unit = UNITS.find(({ min }) => Math.abs(value) >= min)
  if (unit === undefined) {
    return formatCC(amount)
  }
  const scaled = (value / unit.divisor).toFixed(2).replace(/\.?0+$/, '')
  return `${scaled}${unit.suffix}`
}

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

// Whether formatCCCompact dropped digits, which is the only case where showing the exact figure
// somewhere else earns its keep.
export const isCompacted = (amount: string): boolean => Math.abs(Number(amount)) >= COMPACT_FROM
