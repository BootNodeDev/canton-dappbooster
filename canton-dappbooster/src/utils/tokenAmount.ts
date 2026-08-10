// Canton amounts are already fixed-point: Daml `Decimal` is `Numeric 10`, and the JSON Ledger API
// carries it as a decimal string. There is no ERC-20 scaling factor, so `precision` caps decimal
// places and `bigint` exists here only to make comparisons exact.

/** Decimal places Daml `Decimal` (`Numeric 10`) accepts. */
export const DEFAULT_PRECISION = 10

// `Numeric 38,10`: 38 significant digits total, so 28 integer digits at precision 10.
const TOTAL_DIGITS = 38

/**
 * Why an amount is not usable. Codes rather than sentences: L2 ships no user-facing copy, so the
 * consumer maps these to their own wording.
 *
 * @example
 * const MESSAGES: Record<TokenAmountError, string> = { 'above-max': 'More than you hold', … }
 */
export type TokenAmountError = 'not-a-number' | 'too-many-decimals' | 'too-large' | 'above-max'

// Unsigned, no exponent: a token amount is neither negative nor scientific. A trailing dot passes,
// because it is a value mid-typing rather than a broken one.
const DECIMAL = /^\d*(\.\d*)?$/

interface LocaleNumbers {
  group: string
  decimal: string
  grouper: Intl.NumberFormat
}

// Constructing an `Intl.NumberFormat` costs far more than formatting with one, and a field formats
// its value and its balance on every keystroke, so both live here per locale.
const localeCache = new Map<string, LocaleNumbers>()

// Latin digits are forced: a locale whose default numbering system is not `latn` would render
// digits `BigInt` and the sanitizer cannot read back.
const partsOf = (locale?: string): LocaleNumbers => {
  const cached = localeCache.get(locale ?? '')
  if (cached !== undefined) return cached
  const parts = new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).formatToParts(12345.6)
  const entry: LocaleNumbers = {
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    grouper: new Intl.NumberFormat(locale, { maximumFractionDigits: 0, numberingSystem: 'latn' }),
  }
  localeCache.set(locale ?? '', entry)
  return entry
}

const split = (value: string): [string, string] => {
  const dot = value.indexOf('.')
  return dot === -1 ? [value, ''] : [value.slice(0, dot), value.slice(dot + 1)]
}

/**
 * Scales a decimal string to an integer at `precision`, which is the only exact way to compare two
 * amounts. `undefined` when the value is not a decimal or carries more places than `precision` can
 * hold, since dropping a digit would silently change the amount.
 *
 * Reach for {@link validateAmount} instead where the caller needs to say what went wrong.
 *
 * @example
 * parseAmount('1.5') // 15000000000n
 */
export const parseAmount = (
  value: string,
  precision: number = DEFAULT_PRECISION,
): bigint | undefined => {
  if (value === '' || !DECIMAL.test(value)) return undefined
  const [int, frac] = split(value)
  if (frac.length > precision) return undefined
  return BigInt(`${int === '' ? '0' : int}${frac.padEnd(precision, '0')}`)
}

/**
 * The inverse of {@link parseAmount}: a scaled integer back to a canonical decimal string with no
 * trailing zeros.
 *
 * @example
 * formatScaled(15000000000n) // '1.5'
 */
export const formatScaled = (scaled: bigint, precision: number = DEFAULT_PRECISION): string => {
  const digits = scaled.toString().padStart(precision + 1, '0')
  const cut = digits.length - precision
  const frac = digits.slice(cut).replace(/0+$/, '')
  return frac === '' ? digits.slice(0, cut) : `${digits.slice(0, cut)}.${frac}`
}

/**
 * Groups the integer part for reading and leaves the fraction verbatim, so a value still being
 * typed (`1.`, `1.50`) survives. `Intl` is handed the string unparsed, which formats it exactly
 * where the float would drift. The grouping and decimal separators are the locale's, so a caller
 * reading the result back has to read it with the same locale.
 *
 * @example
 * formatAmount('8421337.1234567891') // '8,421,337.1234567891'
 */
export const formatAmount = (value: string, locale?: string): string => {
  if (!DECIMAL.test(value)) return value
  const [int, frac] = split(value)
  const { decimal, grouper } = partsOf(locale)
  const grouped = int === '' ? '' : grouper.format(BigInt(int))
  return value.includes('.') ? `${grouped}${decimal}${frac}` : grouped
}

/**
 * Reduces raw field input to a decimal: grouping separators and anything that can never belong to
 * an amount are dropped rather than flagged, so a paste of `1,234.5` lands as `1234.5`.
 *
 * @example
 * sanitizeAmountInput('.5') // '0.5'
 */
export const sanitizeAmountInput = (input: string, locale?: string): string => {
  const { group, decimal } = partsOf(locale)
  const kept = input
    .replaceAll(group, '')
    .replaceAll(decimal, '.')
    .replace(/[^\d.]/g, '')
  const dot = kept.indexOf('.')
  const int = (dot === -1 ? kept : kept.slice(0, dot)).replace(/^0+(?=\d)/, '')
  if (dot === -1) return int
  // A second separator is dropped, not treated as a new one.
  return `${int === '' ? '0' : int}.${kept.slice(dot + 1).replace(/\./g, '')}`
}

/**
 * Settles a value the user has finished editing. Only a dangling separator goes: trailing fraction
 * zeros are the user's to keep, and they parse to the same amount either way.
 *
 * @example
 * settleAmount('1.') // '1'
 */
export const settleAmount = (value: string): string =>
  value.endsWith('.') ? value.slice(0, -1) : value

/**
 * Checks an amount against the token's precision, the `Numeric 38,10` ceiling, and an optional
 * range. Returns `undefined` when nothing is wrong, including for the empty string: empty is empty,
 * and required-ness belongs to the form.
 *
 * @example
 * validateAmount('1.5000000001', { max: '1.5' }) // 'above-max'
 */
export const validateAmount = (
  value: string,
  { precision = DEFAULT_PRECISION, max }: { precision?: number; max?: string } = {},
): TokenAmountError | undefined => {
  if (value === '') return undefined

  // The parse is the only gate the shape needs: it rejects a non-decimal and an over-long fraction,
  // and the regex only has to say which of the two it was.
  const scaled = parseAmount(value, precision)
  if (scaled === undefined) return DECIMAL.test(value) ? 'too-many-decimals' : 'not-a-number'
  if (split(value)[0].replace(/^0+/, '').length > TOTAL_DIGITS - precision) return 'too-large'

  // `parseAmount('')` is `undefined`, so an absent `max` reads as no ceiling.
  const scaledMax = parseAmount(max ?? '', precision)
  if (scaledMax !== undefined && scaled > scaledMax) return 'above-max'

  return undefined
}
