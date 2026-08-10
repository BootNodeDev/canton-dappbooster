import { formatScaled, parseAmount } from '@bootnodedev/canton-dappbooster'

// Amounts are decimal strings, because a double cannot round-trip 10 dp past six integer digits.
// Every operation scales to integers, works there, and formats back.

// Fixed by this app's Daml domain (`Numeric 10`), not by the kit's `DEFAULT_PRECISION` default.
export const PRECISION = 10
// Indexed rather than exponentiated per call: rounding runs for every amount on screen, every tick.
const POW10 = Array.from({ length: PRECISION + 1 }, (_, i) => 10n ** BigInt(i))
const SCALE = POW10[PRECISION]

// Reads an unparseable value as zero, deliberately: every caller below feeds a figure on screen, and
// throwing mid-render would blank the page over one bad row. Ingress guards the shape instead
// (`amountOf` in the backend mappers), and the one path that must not fold, `canonicalAmount`,
// parses again and throws.
const scaled = (value: string): bigint => parseAmount(value, PRECISION) ?? 0n

export const addAmounts = (...values: string[]): string =>
  formatScaled(
    values.reduce((total, value) => total + scaled(value), 0n),
    PRECISION,
  )

/** Floors at zero: no figure this app shows is meaningful as a negative amount. */
export const subtractAmounts = (a: string, b: string): string => {
  const difference = scaled(a) - scaled(b)
  return formatScaled(difference < 0n ? 0n : difference, PRECISION)
}

/**
 * Scales an amount by a vesting fraction. The fraction is a ratio of elapsed time and so is
 * approximate by nature; flooring it to `PRECISION` before multiplying means the product never
 * overstates what has actually vested — rounding up here would let `claimable` exceed the true
 * vested amount by a hair, which is a command the ledger rejects rather than a harmless display
 * quirk. The two guards clamp a fraction outside [0, 1]: a negative one would otherwise reach
 * `formatScaled` as a negative `bigint` and format as garbage.
 */
export const multiplyByFraction = (amount: string, fraction: number): string => {
  if (fraction <= 0) return '0'
  if (fraction >= 1) return formatScaled(scaled(amount), PRECISION)
  return formatScaled(
    (scaled(amount) * BigInt(Math.floor(fraction * 10 ** PRECISION))) / SCALE,
    PRECISION,
  )
}

// Exact product of two decimal amounts (e.g. a total and a USD rate), scaled once and formatted back.
export const multiplyAmounts = (a: string, b: string): string =>
  formatScaled((scaled(a) * scaled(b)) / SCALE, PRECISION)

/**
 * Rounds a decimal string to `precision` places (half away from zero) and returns it canonical, no
 * trailing zeros. Amounts here never go negative (see `subtractAmounts`), so there is no tie-break
 * direction to pick for negatives. Display-only: `Intl.NumberFormat.format` is typed for
 * `number | bigint`, not the decimal strings this app carries, so a formatter rounds via this first
 * and then groups the already-rounded, already-exact result.
 */
export const roundAmount = (value: string, precision: number): string => {
  const exact = scaled(value)
  if (precision >= PRECISION) return formatScaled(exact, PRECISION)
  const divisor = POW10[PRECISION - precision]
  return formatScaled((exact + divisor / 2n) / divisor, precision)
}

/**
 * Canonical form for a value on its way to the ledger. Throws rather than silently zeroing, because
 * a malformed amount must not become 0 — a Daml `Numeric` literal has no trailing-dot form, so this
 * also rejects a value like `'1000.'` that a permissive input filter lets through.
 */
export const canonicalAmount = (value: string): string => {
  const parsed = parseAmount(value, PRECISION)
  if (parsed === undefined) {
    throw new Error(`Not a valid amount at ${PRECISION} decimal places: ${value}`)
  }
  return formatScaled(parsed, PRECISION)
}

export const compareAmounts = (a: string, b: string): number => {
  const left = scaled(a)
  const right = scaled(b)
  return left < right ? -1 : left > right ? 1 : 0
}

export const isZero = (value: string): boolean => scaled(value) === 0n

/** Also false for the empty string, which reads as zero — an empty field is never a real amount. */
export const isPositive = (value: string): boolean => scaled(value) > 0n

/**
 * Whether a string is a decimal this app can carry exactly. The ingress guard: use it to reject a
 * value at the boundary it arrives at, where the caller names what was wrong with it.
 * {@link canonicalAmount} is the one that also rewrites.
 */
export const isAmount = (value: string): boolean => parseAmount(value, PRECISION) !== undefined

/** For chart geometry and percentages only, never for a figure on its way to the ledger. */
export const toNumber = (value: string): number => Number(value)
