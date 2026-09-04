import { DEFAULT_PRECISION, formatAmount, formatScaled, parseAmount } from '#src/utils/tokenAmount'

const PLACES = 2
const STEP = 10n ** BigInt(DEFAULT_PRECISION - PLACES)

// A row's figures are for comparing at a glance, so they carry two decimals whatever the amount is:
// a bare `0` beside `2,134.78` reads as a different kind of number. The exact value is the field's
// to show, and `formatAmount` is what shows it.
export const formatFigure = (value: string): string => {
  const scaled = parseAmount(value) ?? 0n
  const [int, frac = ''] = formatScaled((scaled + STEP / 2n) / STEP, PLACES).split('.')
  return formatAmount(`${int}.${frac.padEnd(PLACES, '0')}`)
}
