// Groups an integer string with comma thousands separators.
const groupThousands = (whole: string): string => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const DECIMAL_RE = /^\d+(\.\d+)?$/

// Formats a decimal token amount for display: two decimals, half-up rounding, and
// comma-grouped thousands. Falls back to the raw string for non-numeric values so
// labels like "unknown" pass through untouched. BigInt keeps precision past Number range.
export const formatTokenAmount = (value: string): string => {
  const trimmed = value.trim()
  if (!DECIMAL_RE.test(trimmed)) {
    return value
  }
  const [whole, fraction = ''] = trimmed.split('.')
  let cents = Number.parseInt(`${fraction}00`.slice(0, 2), 10)
  let wholeValue = BigInt(whole)
  // Round half up using the first dropped digit.
  if ((fraction[2] ?? '0') >= '5') {
    cents += 1
    if (cents === 100) {
      cents = 0
      wholeValue += 1n
    }
  }
  return `${groupThousands(wholeValue.toString())}.${cents.toString().padStart(2, '0')}`
}

// Strips grouping commas and any non-decimal characters, collapsing extra dots and
// normalizing a leading dot to "0." so the stored amount stays a plain decimal string.
export const stripAmountGroups = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  const normalizedWhole = whole === '' && rest.length > 0 ? '0' : whole
  return rest.length === 0 ? normalizedWhole : `${normalizedWhole}.${rest.join('')}`
}

// Groups the integer part of a partial amount with commas, keeping the fraction and a
// trailing dot intact so it can format live while the user types.
export const formatAmountInput = (value: string): string => {
  const cleaned = stripAmountGroups(value)
  if (cleaned === '') {
    return ''
  }
  const dot = cleaned.indexOf('.')
  return dot === -1
    ? groupThousands(cleaned)
    : `${groupThousands(cleaned.slice(0, dot))}${cleaned.slice(dot)}`
}

// Compares two decimal strings exactly (no float). Returns -1/0/1, or undefined for non-decimals.
export const compareDecimalStrings = (a: string, b: string): -1 | 0 | 1 | undefined => {
  const ta = a.trim()
  const tb = b.trim()
  if (!DECIMAL_RE.test(ta) || !DECIMAL_RE.test(tb)) {
    return undefined
  }
  const [aw, af = ''] = ta.split('.')
  const [bw, bf = ''] = tb.split('.')
  const scale = Math.max(af.length, bf.length)
  const av = BigInt(`${aw}${af.padEnd(scale, '0')}`)
  const bv = BigInt(`${bw}${bf.padEnd(scale, '0')}`)
  return av < bv ? -1 : av > bv ? 1 : 0
}
