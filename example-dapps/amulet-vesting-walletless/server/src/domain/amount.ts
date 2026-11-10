// Amounts are decimal strings, because a double cannot round-trip 10 dp past six integer digits.
// Every operation scales to integers, works there, and formats back. The subset of the frontend's
// `utils/amount.ts` the ledger layer needs, with the kit's parse/format pair inlined so the server
// does not pull in a React package for two functions.

// Fixed by this app's Daml domain (`Numeric 10`).
const PRECISION = 10
const DECIMAL = /^\d*(\.\d*)?$/

const parseAmount = (value: string): bigint | undefined => {
  if (value === '' || !DECIMAL.test(value)) return undefined
  const dot = value.indexOf('.')
  const [int, frac] = dot === -1 ? [value, ''] : [value.slice(0, dot), value.slice(dot + 1)]
  if (frac.length > PRECISION) return undefined
  return BigInt(`${int === '' ? '0' : int}${frac.padEnd(PRECISION, '0')}`)
}

const formatScaled = (scaled: bigint): string => {
  const digits = scaled.toString().padStart(PRECISION + 1, '0')
  const cut = digits.length - PRECISION
  const frac = digits.slice(cut).replace(/0+$/, '')
  return frac === '' ? digits.slice(0, cut) : `${digits.slice(0, cut)}.${frac}`
}

// Reads an unparseable value as zero; `canonicalAmount` is the path that must not fold, and throws.
const scaled = (value: string): bigint => parseAmount(value) ?? 0n

export const addAmounts = (...values: string[]): string =>
  formatScaled(values.reduce((total, value) => total + scaled(value), 0n))

// Canonical form for a value on its way to the ledger; throws rather than silently zeroing. A Daml
// `Numeric` literal has no trailing-dot form, so `'1000.'` goes out as `'1000'`.
export const canonicalAmount = (value: string): string => {
  const parsed = parseAmount(value)
  if (parsed === undefined) {
    throw new Error(`Not a valid amount at ${PRECISION} decimal places: ${value}`)
  }
  return formatScaled(parsed)
}

export const compareAmounts = (a: string, b: string): number => {
  const left = scaled(a)
  const right = scaled(b)
  return left < right ? -1 : left > right ? 1 : 0
}

// The ingress guard: reject a value where it arrives, so the caller can name what was wrong with it.
export const isAmount = (value: string): boolean => parseAmount(value) !== undefined
