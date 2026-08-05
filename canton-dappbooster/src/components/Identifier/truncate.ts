/**
 * Character counts overriding the display defaults of {@link truncateIdentifier}: how much to keep
 * either side of the ellipsis, and the segment length below which nothing is cut.
 *
 * @example
 * truncateIdentifier(partyId, { head: 4, tail: 4, threshold: 22 })
 */
export interface TruncateOptions {
  head?: number
  tail?: number
  threshold?: number
}

// A party id already shows a readable hint, so its fingerprint needs less head than a bare id.
const PARTY_HEAD = 6
const PLAIN_HEAD = 12
const TAIL = 8
const THRESHOLD = 22
const ELLIPSIS = '…'

const PARTY_SEPARATOR = '::'

// The one place the party-id shape is asserted, so the truncator and the link builder agree.
export const isPartyId = (value: string): boolean => value.includes(PARTY_SEPARATOR)

const middle = (value: string, head: number, tail: number, threshold: number): string => {
  if (value.length <= threshold) return value
  const start = value.slice(0, Math.max(head, 0))
  // `slice(-0)` is `slice(0)` — the whole string — so a zero tail needs its own branch.
  const end = tail > 0 ? value.slice(-tail) : ''
  // Overlapping head and tail would repeat characters and outgrow the input.
  return start.length + end.length >= value.length ? value : `${start}${ELLIPSIS}${end}`
}

/**
 * Truncates an identifier for display. A Canton party id is `hint::fingerprint`: the hint is
 * meaningful, so it survives whole and only the fingerprint shrinks. Anything else is
 * middle-truncated as one segment. Output is never longer than the input, and cuts land on UTF-16
 * code units, so a non-ASCII value can split a surrogate pair.
 *
 * Reach for this over `<Identifier>` when the value sits inside a sentence, or inside another
 * `<button>`, where the component's copy control would nest a button in a button.
 *
 * @example
 * truncateIdentifier('nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46')
 * // 'nico::1220df…0b1cbb46'
 */
export const truncateIdentifier = (value: string, options?: TruncateOptions): string => {
  const tail = options?.tail ?? TAIL
  const threshold = options?.threshold ?? THRESHOLD
  const separator = value.indexOf(PARTY_SEPARATOR)

  if (separator === -1) {
    return middle(value, options?.head ?? PLAIN_HEAD, tail, threshold)
  }

  const hint = value.slice(0, separator)
  const fingerprint = value.slice(separator + PARTY_SEPARATOR.length)
  const short = middle(fingerprint, options?.head ?? PARTY_HEAD, tail, threshold)
  return `${hint}${PARTY_SEPARATOR}${short}`
}

/**
 * The readable half of a party id. Returns the whole value when there is no separator. Reach for
 * this over {@link truncateIdentifier} where the fingerprint should be dropped rather than
 * shortened, such as a table column or a chart label.
 *
 * @example
 * partyHint('nico::1220df94') // 'nico'
 */
export const partyHint = (value: string): string => {
  const separator = value.indexOf(PARTY_SEPARATOR)
  return separator === -1 ? value : value.slice(0, separator)
}
