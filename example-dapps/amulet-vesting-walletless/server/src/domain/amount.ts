// Fixed by this app's Daml domain (`Numeric 10`).
const PRECISION = 10
const DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/

// The kit's parse and format, inlined so the server pulls in no React package for two functions.
const parseAmount = (value: string): bigint | undefined => {
  if (!DECIMAL.test(value)) return undefined
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

const scaled = (value: string): bigint => parseAmount(value) ?? 0n

export const addAmounts = (...values: string[]): string =>
  formatScaled(values.reduce((total, value) => total + scaled(value), 0n))

// A Daml `Numeric` literal has no trailing-dot form, so `'1000.'` goes out as `'1000'`.
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

export const isAmount = (value: string): boolean => parseAmount(value) !== undefined
