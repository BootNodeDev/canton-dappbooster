import { formatAmount, formatFigure, parseAmount } from '@bootnodedev/canton-dappbooster'
import { roundAmount } from '@/utils/amount'

const NOT_AVAILABLE = 'N/A'

export const formatFigureFull = (amount: string): string =>
  parseAmount(amount) === undefined ? NOT_AVAILABLE : formatAmount(roundAmount(amount, 10))

const COMPACT_FROM = 1e4

const UNITS = [
  { min: 1e12, divisor: 1e12, suffix: 'T' },
  { min: 1e9, divisor: 1e9, suffix: 'B' },
  { min: 1e6, divisor: 1e6, suffix: 'M' },
  { min: COMPACT_FROM, divisor: 1e3, suffix: 'K' },
]

export const formatFigureCompact = (amount: string): string => {
  // A float is safe here: the result is approximate by design, never submitted or compared
  const value = Number(amount)
  const unit = UNITS.find(({ min }) => Math.abs(value) >= min)
  if (unit === undefined) {
    return formatFigure(amount) ?? NOT_AVAILABLE
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

export const isCompacted = (amount: string): boolean => Math.abs(Number(amount)) >= COMPACT_FROM
