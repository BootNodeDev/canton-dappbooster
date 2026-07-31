// Mapping a CIP-0103 listAccounts response to the package's Party type.

import type { dappAPI } from '@canton-network/dapp-sdk'
import type { Party } from './types'

// One entry of a CIP-0103 listAccounts response, before mapping to Party.
interface RawWalletAccount {
  primary?: boolean
  partyId: string
  hint?: string
  publicKey?: string
  networkId?: string
  status?: dappAPI.WalletStatus
  // Never filter on this: a disabled party still works — it signs through the participant.
  disabled?: boolean
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

// Only an allocated party exists on the ledger; a missing status is trusted (older wallets).
const isUsable = (account: RawWalletAccount): boolean =>
  account.status === undefined || account.status === 'allocated'

// Every usable account as a Party: primary first, wallet order otherwise.
export const toParties = (accounts: RawWalletAccount[], fallbackNetworkId: string): Party[] => {
  const usable = accounts.filter(isUsable)
  const primary = selectPrimaryAccount(usable)

  const ordered =
    primary === undefined ? usable : [primary, ...usable.filter((account) => account !== primary)]

  return ordered.map((account) => toParty(account, fallbackNetworkId))
}
