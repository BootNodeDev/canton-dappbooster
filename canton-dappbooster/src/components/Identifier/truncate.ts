import { PARTY_SEPARATOR } from '../../utils/partyId'

/**
 * Character counts overriding the display defaults of {@link truncateIdentifier}: how much to keep
 * either side of the ellipsis, the segment length below which nothing is cut, and the bound on a
 * party id's hint, which is otherwise kept whole however long it is.
 *
 * @example
 * truncateIdentifier(partyId, { head: 4, tail: 4, threshold: 22 })
 * truncateIdentifier(partyId, { hint: 12 })
 */
export interface TruncateOptions {
  head?: number
  tail?: number
  threshold?: number
  hint?: number
}

// A party id already shows a readable hint, so its fingerprint needs less head than a bare id.
const PARTY_HEAD = 6
const PLAIN_HEAD = 12
const TAIL = 8
const THRESHOLD = 22
const ELLIPSIS = '…'

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
 * meaningful, so it survives whole and only the fingerprint shrinks, unless `hint` bounds it too.
 * Anything else is middle-truncated as one segment. Output is never longer than the input, and cuts
 * land on UTF-16 code units, so a non-ASCII value can split a surrogate pair.
 *
 * Reach for this over `<Identifier>` when the value sits inside a sentence, or inside another
 * `<button>`, where the component's copy control would nest a button in a button. Pass `hint`
 * wherever the result has to fit a bounded width, since an unbounded hint has no display length.
 *
 * @example
 * truncateIdentifier('nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46')
 * // 'nico::1220df…0b1cbb46'
 * truncateIdentifier('treasury-operations::1220df94…', { hint: 12 })
 * // 'treasury-ope…::1220df94…'
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
  // A hint reads from its start, so it keeps a head and no tail where the other segments keep both.
  const shortHint = options?.hint === undefined ? hint : middle(hint, options.hint, 0, options.hint)
  return `${shortHint}${PARTY_SEPARATOR}${short}`
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
