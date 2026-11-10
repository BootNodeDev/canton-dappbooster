import { formatScaled, parseAmount } from '@bootnodedev/canton-dappbooster'

// Fixed by this app's Daml domain (`Numeric 10`), not by the kit's `DEFAULT_PRECISION` default.
export const PRECISION = 10
// Indexed rather than exponentiated per call: rounding runs for every amount on screen, every tick.
const POW10 = Array.from({ length: PRECISION + 1 }, (_, i) => 10n ** BigInt(i))
const SCALE = POW10[PRECISION]

// Zero rather than a throw for a bad value: a throw mid-render blanks the page over one bad row
const scaled = (value: string): bigint => parseAmount(value, PRECISION) ?? 0n

export const addAmounts = (...values: string[]): string =>
  formatScaled(
    values.reduce((total, value) => total + scaled(value), 0n),
    PRECISION,
  )

// Floors at zero: no figure this app shows is meaningful as a negative amount.
export const subtractAmounts = (a: string, b: string): string => {
  const difference = scaled(a) - scaled(b)
  return formatScaled(difference < 0n ? 0n : difference, PRECISION)
}

export const multiplyByFraction = (amount: string, fraction: number): string => {
  // Outside [0, 1], `formatScaled` would get a negative bigint and format it as garbage.
  if (fraction <= 0) return '0'
  if (fraction >= 1) return formatScaled(scaled(amount), PRECISION)
  // Floored so claimable never exceeds what has vested, which the ledger would reject
  return formatScaled(
    (scaled(amount) * BigInt(Math.floor(fraction * 10 ** PRECISION))) / SCALE,
    PRECISION,
  )
}

// Display-only: `Intl.NumberFormat` takes no decimal string, so a formatter rounds here first
export const roundAmount = (value: string, precision: number): string => {
  const exact = scaled(value)
  if (precision >= PRECISION) return formatScaled(exact, PRECISION)
  const divisor = POW10[PRECISION - precision]
  return formatScaled((exact + divisor / 2n) / divisor, precision)
}

export const compareAmounts = (a: string, b: string): number => {
  const left = scaled(a)
  const right = scaled(b)
  return left < right ? -1 : left > right ? 1 : 0
}

export const isZero = (value: string): boolean => scaled(value) === 0n

// False for the empty string too, which reads as zero: an empty field is never a real amount
export const isPositive = (value: string): boolean => scaled(value) > 0n

export const toNumber = (value: string): number => Number(value)
