// A Canton party id is `hint::fingerprint`.
export const PARTY_SEPARATOR = '::'

// Asserts if a string is party-id-shaped
export const isPartyId = (value: string): boolean => value.includes(PARTY_SEPARATOR)
