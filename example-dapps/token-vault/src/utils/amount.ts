import { formatScaled, parseAmount } from '@bootnodedev/canton-dappbooster'

// Fixed by the forge's `Numeric 10`, not by the kit's `DEFAULT_PRECISION` default.
const PRECISION = 10

// Also false for the empty string, which reads as zero: an empty field is never a real amount.
export const isPositive = (value: string): boolean => (parseAmount(value, PRECISION) ?? 0n) > 0n

// Throws rather than zeroing, and drops a trailing dot, which a Daml `Numeric` has no form for.
export const canonicalAmount = (value: string): string => {
  const parsed = parseAmount(value, PRECISION)
  if (parsed === undefined) {
    throw new Error(`Not a valid amount at ${PRECISION} decimal places: ${value}`)
  }
  return formatScaled(parsed, PRECISION)
}
