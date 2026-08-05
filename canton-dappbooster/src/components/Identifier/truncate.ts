/** Overrides for {@link truncateIdentifier}. Omitted fields fall back to the display defaults. */
export interface TruncateOptions {
  /** Characters kept from the start of the truncated segment. */
  head?: number
  /** Characters kept from the end of the truncated segment. */
  tail?: number
  /** Segments this short are left alone. */
  threshold?: number
}

/** A party id already shows a readable hint, so its fingerprint needs less head than a bare id. */
const PARTY_HEAD = 6
const PLAIN_HEAD = 12
const TAIL = 8
const THRESHOLD = 22
const ELLIPSIS = '…'

const PARTY_SEPARATOR = '::'

/** The one place the party-id shape is asserted, so the truncator and the link builder agree. */
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
 * middle-truncated as one segment. Output is never longer than the input. Cuts on UTF-16 code
 * units, so a non-ASCII value can split a surrogate pair.
 *
 * Reach for this over `<Identifier>` when the value sits inside a sentence, or inside another
 * `<button>` — the component's copy control would nest a button in a button.
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
 */
export const partyHint = (value: string): string => {
  const separator = value.indexOf(PARTY_SEPARATOR)
  return separator === -1 ? value : value.slice(0, separator)
}
