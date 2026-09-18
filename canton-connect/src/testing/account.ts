import type { Account } from '#src/types'

/** An `Account` for tests; the namespace is the id's suffix, as the fake and mock wallets report. */
export const testAccount = (partyId: string, networkId = 'canton:local'): Account => ({
  primary: true,
  partyId,
  status: 'allocated',
  hint: partyId.split('::')[0] ?? partyId,
  publicKey: 'test-public-key',
  namespace: partyId.split('::')[1] ?? partyId,
  networkId,
  signingProviderId: 'test',
})
