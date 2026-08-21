// A Canton party id is `hint::fingerprint`.
export const PARTY_SEPARATOR = '::'

/**
 * Why a value is not a well-formed party id. Codes rather than sentences: L2 ships no user-facing
 * copy, so the consumer maps these to their own wording.
 *
 * @example
 * const MESSAGES: Record<PartyIdError, string> = {
 *   'missing-separator': 'Use hint::fingerprint',
 *   'invalid-hint': 'The hint cannot be blank or contain spaces',
 *   'invalid-fingerprint': 'The fingerprint is 68 hex characters',
 * }
 *
 * @category Utilities
 */
export type PartyIdError = 'missing-separator' | 'invalid-hint' | 'invalid-fingerprint'

// A Canton fingerprint is a `1220`-prefixed sha256 multihash: exactly 68 hex characters. The prefix
// itself is not pinned, since it encodes the hash algorithm and a future one would move it.
const FINGERPRINT = /^[0-9a-f]{68}$/i

/**
 * Checks the shape of a party id: a non-blank hint, the `::` separator, and a 68-character hex
 * fingerprint. Returns `undefined` when nothing is wrong. Shape only — whether the party exists is
 * the ledger's answer, not this function's.
 *
 * Reach for this over {@link isValidPartyId} when the caller needs to say what went wrong.
 *
 * @example
 * validatePartyId('nico:1220df94') // 'missing-separator'
 * validatePartyId('nico::1220df94') // 'invalid-fingerprint': 8 hex characters, not 68
 *
 * @category Utilities
 */
export const validatePartyId = (value: string): PartyIdError | undefined => {
  const separator = value.indexOf(PARTY_SEPARATOR)
  if (separator === -1) return 'missing-separator'

  const hint = value.slice(0, separator)
  // Canton owns the real hint charset and rejects server-side; this catches only shape typos.
  if (hint.trim() === '' || /\s/.test(hint)) return 'invalid-hint'

  // Everything after the first separator, so a second `::` fails the hex test rather than passing.
  const fingerprint = value.slice(separator + PARTY_SEPARATOR.length)
  return FINGERPRINT.test(fingerprint) ? undefined : 'invalid-fingerprint'
}

/**
 * Whether a party id is well-formed. Reach for {@link validatePartyId} instead where the reason
 * matters.
 *
 * @example
 * isValidPartyId(partyId) // true
 * isValidPartyId('nico::1220df94') // false: 8 hex characters where 68 are required
 *
 * @category Utilities
 */
export const isValidPartyId = (value: string): boolean => validatePartyId(value) === undefined
