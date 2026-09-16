// Reading a CIP-0103 listAccounts response. The primary is the user's own choice in the wallet, so
// it is taken as flagged and never substituted; whether it can transact is a separate question the
// caller asks, and answers, for itself.

import { WALLET_DISABLED_REASON } from '@canton-network/core-types'
import type { Account } from '#src/types'

/**
 * Whether an account still has ledger rights to act as a party. The primary is never substituted,
 * so ask this before an action and report the answer rather than acting as another account.
 *
 * @example
 * const { account } = useAccount()
 * account !== undefined && !isUsableAccount(account) && <p>This account cannot transact.</p>
 *
 * @category Utilities
 */
export const isUsableAccount = (account: Account): boolean => {
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

/** The account the wallet flagged `primary`, usable or not. */
export const getPrimaryAccount = (accounts: Account[]): Account | undefined =>
  accounts.find((account) => account.primary)
