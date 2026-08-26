import type { FakeWallet } from '#src/testing/fakeWallet'

/** The statusChanged wallet-a pushes on lock. */
export const pushLock = (wallet: FakeWallet): void =>
  wallet.push('statusChanged', {
    provider: { id: 'wallet-a', providerType: 'browser' },
    // Network stays up; only the wallet locks: proves the handler keys on isConnected alone.
    connection: { isConnected: false, isNetworkConnected: true },
  })

/** The statusChanged wallet-a pushes on unlock. */
export const pushUnlock = (wallet: FakeWallet): void =>
  wallet.push('statusChanged', {
    provider: { id: 'wallet-a', providerType: 'browser' },
    connection: { isConnected: true, isNetworkConnected: true },
  })
