import { createFakeWallet, type FakeWallet } from '#src/testing/fakeWallet'

/** The fake wallet the connect/events/guards/restore provider tests connect through. */
export const walletA = (): FakeWallet =>
  createFakeWallet({
    id: 'wallet-a',
    target: 'wallet-a',
    accounts: [{ partyId: 'alice::1220ab', primary: true }],
  })
