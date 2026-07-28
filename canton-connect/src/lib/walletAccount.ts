// Selecting a single party from a CIP-0103 listAccounts response. Wallets
// typically tag exactly one entry with `primary: true`; this helper falls
// back to the first entry when nothing is flagged.

import type { Party } from '../types'

export interface RawWalletAccount {
  primary?: boolean
  partyId: string
  hint?: string
  publicKey?: string
  networkId?: string
}

export const selectPrimaryAccount = (accounts: RawWalletAccount[]): RawWalletAccount | undefined =>
  accounts.find((a) => a.primary) ?? accounts[0]

export const toParty = (account: RawWalletAccount, fallbackNetwork: string): Party => ({
  partyId: account.partyId,
  network: account.networkId ?? fallbackNetwork,
  ...(account.hint === undefined ? {} : { name: account.hint }),
  ...(account.publicKey === undefined ? {} : { publicKey: account.publicKey }),
})
