// Hosted wallet over the wallet-service. listParties() reads the service's
// CanActAs pool; execute() submits via the ledgerApi proxy (no signing popup).
import { walletServiceRequest } from '@/backend/ledgerApi'
import type { PartyRef } from '@/backend/VestingBackend'
import type { DisclosedContract, LedgerCommand, Wallet } from './Wallet'

type Account = { partyId: string; hint?: string }

// Coupled pair: the `vesting-<name>-<stamp>` format is set by WALLET_SERVICE_ACCOUNTS_PREFIX
// on the server; this regex must stay in sync with that prefix convention.
const friendlyName = (hint: string): string => {
  const match = /^vesting-(.+)-\d+$/.exec(hint)
  return match?.[1] ?? hint
}

export class StealthWallet implements Wallet {
  private readonly rpcUrl: string

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl
  }

  async listParties(): Promise<PartyRef[]> {
    const accounts = await walletServiceRequest<Account[]>(this.rpcUrl, 'listAccounts')
    return accounts.map((account) => ({
      name: friendlyName(account.hint ?? account.partyId.split('::')[0] ?? account.partyId),
      partyId: account.partyId,
    }))
  }

  execute(
    actingParty: string,
    command: LedgerCommand,
    disclosed?: DisclosedContract[],
  ): Promise<unknown> {
    return walletServiceRequest<unknown>(this.rpcUrl, 'ledgerApi', {
      requestMethod: 'post',
      resource: '/v2/commands/submit-and-wait-for-transaction-tree',
      body: {
        commandId: `vest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        actAs: [actingParty],
        readAs: [actingParty],
        commands: [command],
        ...(disclosed === undefined ? {} : { disclosedContracts: disclosed }),
      },
    })
  }
}
