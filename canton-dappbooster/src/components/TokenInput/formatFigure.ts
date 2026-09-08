import { DEFAULT_PRECISION, formatAmount, formatScaled, parseAmount } from '#src/utils/tokenAmount'

const PLACES = 2

/**
 * Overrides for {@link formatFigure}: the decimal places to round to, 2 by default and clamped to
 * what a ledger amount holds, and the locale whose grouping and decimal separators to use, the
 * runtime's own by default.
 *
 * @example
 * formatFigure('1234.5', { places: 4, locale: 'de-DE' }) // '1.234,5000'
 *
 * @category Utilities
 */
export interface FormatFigureOptions {
  locale?: string
  places?: number
}

/**
 * Rounds an amount to a fixed number of decimals and groups it for reading, so a column of figures
 * compares at a glance where {@link formatAmount} keeps every digit the ledger carries. An amount
 * it cannot read formats to nothing rather than to a zero that would read as a real balance.
 *
 * @example
 * formatFigure('1234.5') // '1,234.50'
 * formatFigure('abc') // undefined
 *
 * @category Utilities
 */
export const formatFigure = (
  value: string | undefined,
  { locale, places = PLACES }: FormatFigureOptions = {},
): string | undefined => {
  const scaled = value === undefined ? undefined : parseAmount(value)

  if (scaled === undefined) return undefined

  const at = Math.max(0, Math.min(Math.trunc(places), DEFAULT_PRECISION))
  const step = 10n ** BigInt(DEFAULT_PRECISION - at)
  const [int, frac = ''] = formatScaled((scaled + step / 2n) / step, at).split('.')

  return formatAmount(at === 0 ? int : `${int}.${frac.padEnd(at, '0')}`, locale)
}
