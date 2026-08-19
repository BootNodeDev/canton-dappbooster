// Selecting a single party from a CIP-0103 listAccounts response. Wallets
// typically tag exactly one entry with `primary: true`; this helper falls
// back to the first entry when nothing is flagged.

import type { Party } from '#src/types'

// One entry of a CIP-0103 listAccounts response, before mapping to Party.
interface RawWalletAccount {
  primary?: boolean
  partyId: string
  hint?: string
  publicKey?: string
  networkId?: string
}

export const selectPrimaryAccount = (accounts: RawWalletAccount[]): RawWalletAccount | undefined =>
  accounts.find((a) => a.primary) ?? accounts[0]

// hint becomes name; an account's own networkId outranks the config fallback.
export const toParty = (account: RawWalletAccount, fallbackNetworkId: string): Party => ({
  partyId: account.partyId,
  networkId: account.networkId ?? fallbackNetworkId,
  ...(account.hint === undefined ? {} : { name: account.hint }),
  ...(account.publicKey === undefined ? {} : { publicKey: account.publicKey }),
})
