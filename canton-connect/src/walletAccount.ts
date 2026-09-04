// Selecting a single party from a CIP-0103 listAccounts response. `primary` is a required boolean
// on every entry, so zero or several may carry it; nothing in the schema promises exactly one.

import { WALLET_DISABLED_REASON } from '@canton-network/core-types'
import type { Wallet } from '@canton-network/dapp-sdk'
import type { Party, PartyType } from '#src/types'

/** The JSON Ledger API resource answering the participant's own id. */
export const PARTICIPANT_ID_RESOURCE = '/v2/parties/participant-id'

/** One entry of a CIP-0103 `listAccounts` response, before it is mapped to a `Party`. */
// Looser than the SDK's `Wallet` on purpose: `createMockAdapter` omits `networkId`, so
// `toParty`'s fallback applies.
interface RawWalletAccount {
  primary?: boolean
  partyId: string
  namespace: string
  signingProviderId: string
  hint?: string
  publicKey?: string
  networkId?: string
  status?: Wallet['status']
  disabled?: Wallet['disabled']
  reason?: Wallet['reason']
}

/** Whether one raw account entry still has ledger rights to act as a party. */
const isUsable = (account: RawWalletAccount): boolean => {
  // Only 'allocated' holds ledger rights; the kernel sets 'initialized' while a party's allocation
  // is pending or after it dropped off the participant, so it can neither sign nor transact.
  if (account.status === 'initialized' || account.status === 'removed') {
    return false
  }

  // `disabled` covers five causes and only one is harmless: an unmatched signing provider keeps
  // its ledger rights and signs through the participant. The rest mean no valid party to act as.
  if (account.disabled === true) {
    return account.reason === WALLET_DISABLED_REASON.NO_SIGNING_PROVIDER_MATCHED
  }

  return true
}

// Excluded by name rather than requiring 'allocated', so a wallet omitting the field still works.
/** Filters a raw account list down to the ones still usable as a party. */
export const selectUsableAccounts = (accounts: RawWalletAccount[]): RawWalletAccount[] =>
  accounts.filter(isUsable)

/** Picks the account flagged `primary`, falling back to the first if none is. */
export const selectPrimaryAccount = (accounts: RawWalletAccount[]): RawWalletAccount | undefined =>
  accounts.find((a) => a.primary) ?? accounts[0]

/** The namespace of a `hint::namespace` id, party or participant alike. */
export const namespaceOf = (id: string): string | undefined => {
  const separator = id.indexOf('::')

  return separator === -1 ? undefined : id.slice(separator + 2)
}

// Canton's definition, not a wallet's: local shares the participant's namespace, external its own.
/** Classifies a party by its namespace against the participant's; `unknown` until that is read. */
export const partyTypeOf = (
  namespace: string,
  participantNamespace: string | undefined,
): PartyType => {
  if (participantNamespace === undefined) {
    return 'unknown'
  }

  return namespace === participantNamespace ? 'local' : 'external'
}

// Same object back when nothing changes, so a selector holding the party does not re-render.
/** Re-derives `partyType` once the participant namespace is known. */
export const withPartyType = (party: Party, participantNamespace: string | undefined): Party => {
  const partyType = partyTypeOf(party.namespace, participantNamespace)

  return partyType === party.partyType ? party : { ...party, partyType }
}

// hint becomes name; an account's own networkId outranks the config fallback; the type waits on the
// participant read.
/** Maps one raw account entry to the public `Party` shape the hooks expose. */
export const toParty = (account: RawWalletAccount, fallbackNetworkId: string): Party => ({
  partyId: account.partyId,
  networkId: account.networkId ?? fallbackNetworkId,
  namespace: account.namespace,
  signingProviderId: account.signingProviderId,
  partyType: 'unknown',
  ...(account.hint === undefined ? {} : { name: account.hint }),
  ...(account.publicKey === undefined ? {} : { publicKey: account.publicKey }),
})
