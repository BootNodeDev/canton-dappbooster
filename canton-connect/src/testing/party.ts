import type { Party } from '#src/types'

/** A `Party` for tests, its namespace read off the party id the way a wallet reports it. */
export const testParty = (partyId: string, networkId = 'canton:local'): Party => ({
  partyId,
  networkId,
  namespace: partyId.split('::')[1] ?? partyId,
  signingProviderId: 'test',
})
