import type { Party } from '#src/types'

/** A `Party` for tests; the namespace is the id's suffix, as the fake and mock wallets report. */
export const testParty = (partyId: string, networkId = 'canton:local'): Party => ({
  partyId,
  networkId,
  namespace: partyId.split('::')[1] ?? partyId,
  signingProviderId: 'test',
})
