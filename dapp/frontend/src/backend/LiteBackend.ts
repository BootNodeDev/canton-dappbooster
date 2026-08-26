// The VestingBackend over the vesting-lite templates, reached through the connected wallet: reads
// go out as the connected party, writes come back with a real approval prompt.

import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
} from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import {
  type AcsRow,
  type ClaimRecord,
  type CreateVestInput,
  claimChain,
  composeNote,
  lastUpdateOffset,
  rowToClaim,
  rowToGrant,
  rowToProposal,
  updatesToClaims,
  type VestingBackend,
  type VestingView,
} from '@/backend/VestingBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'

const mapRows = <T>(rows: AcsRow[], mapper: (row: AcsRow) => T | undefined): T[] =>
  rows.map(mapper).filter((value): value is T => value !== undefined)

// The JSON Ledger API's party/template filter, shared by the ACS read and the update stream. Built
// in one place because a typo in this nesting yields a silent empty read rather than an error.
const templateFilter = (party: string, templateId: string): Record<string, unknown> => ({
  filtersByParty: {
    [party]: {
      cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId } } } }],
    },
  },
})

// A page of claims, and how long the stream may sit quiet before it returns what it has: the
// endpoint is a stream, so without the idle timeout the read never completes.
const CLAIM_HISTORY_LIMIT = 1000
const STREAM_IDLE_MS = 1000
// `limit` counts forward from `beginExclusive` and the endpoint offers no reverse order, so a party
// past one page keeps its oldest claims and loses the recent ones unless the pages are followed.
// Bounded so an offset that fails to advance cannot spin.
const CLAIM_HISTORY_PAGES = 20

export class LiteBackend implements VestingBackend {
  private readonly wallet: WalletFns
  private readonly factory: DisclosedContract
  private readonly proposalTid: string
  private readonly contractTid: string
  private readonly claimTid: string

  constructor(deployment: Deployment, wallet: WalletFns) {
    this.wallet = wallet
    this.factory = {
      templateId: `${deployment.pkg}:Vesting:VestingFactory`,
      contractId: deployment.factoryCid,
      createdEventBlob: deployment.factoryBlob,
      ...(deployment.synchronizerId === undefined
        ? {}
        : { synchronizerId: deployment.synchronizerId }),
    }
    this.proposalTid = `${deployment.pkg}:Vesting:VestingProposal`
    this.contractTid = `${deployment.pkg}:Vesting:VestingContract`
    this.claimTid = `${deployment.pkg}:Vesting:VestedClaim`
  }

  private async ledgerEnd(): Promise<string | number> {
    const result = (await this.wallet.ledgerApi({
      requestMethod: 'get',
      resource: '/v2/state/ledger-end',
    })) as { offset?: string | number }
    if (result.offset === undefined) {
      throw new Error('Ledger API did not return an offset')
    }
    return result.offset
  }

  private async readAcs(
    party: string,
    templateId: string,
    offset: string | number,
  ): Promise<AcsRow[]> {
    const rows = await this.wallet.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        filter: templateFilter(party, templateId),
        activeAtOffset: offset,
        verbose: true,
      },
    })
    return Array.isArray(rows) ? rows : []
  }

  // actAs is explicit rather than left to the wallet's primary account, so a submission that would
  // be signed by the wrong key is rejected by the participant instead of silently reassigned.
  private submit(
    actAs: string,
    command: LedgerCommand,
    disclosedContracts?: DisclosedContract[],
  ): Promise<unknown> {
    return this.wallet.execute({
      actAs: [actAs],
      readAs: [actAs],
      commands: [command],
      ...(disclosedContracts === undefined ? {} : { disclosedContracts }),
    })
  }

  async viewAs(partyId: string): Promise<VestingView> {
    // One ledger-end fetch for all three reads, so they share a consistent snapshot offset.
    const offset = await this.ledgerEnd()
    const [proposalRows, contractRows, claimRows] = await Promise.all([
      this.readAcs(partyId, this.proposalTid, offset),
      this.readAcs(partyId, this.contractTid, offset),
      this.readAcs(partyId, this.claimTid, offset),
    ])
    return {
      proposals: mapRows(proposalRows, rowToProposal),
      grants: mapRows(contractRows, rowToGrant),
      claims: mapRows(claimRows, rowToClaim),
    }
  }

  // The funder is not a stakeholder of the operator's observer-less factory and cannot read it, so
  // its disclosure payload comes from the bootstrap's config file; the blob size lets the UI surface
  // that mechanic.
  async createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }> {
    const command = buildCreateVestingCommand(this.factory.templateId, this.factory.contractId, {
      proposer: args.proposer,
      beneficiary: args.receiver,
      total: args.totalAmount,
      schedule: args.schedule,
      note: composeNote(args.title, args.note),
    })
    await this.submit(args.proposer, command, [this.factory])
    return { disclosedBytes: this.factory.createdEventBlob.length }
  }

  // `TRANSACTION_SHAPE_LEDGER_EFFECTS` is what carries the exercise; the default ACS-delta shape
  // would only show the contract being replaced.
  private readUpdates(
    partyId: string,
    beginExclusive: string | number,
    endInclusive: string | number,
  ): Promise<unknown> {
    return this.wallet.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/updates',
      query: { limit: CLAIM_HISTORY_LIMIT, stream_idle_timeout_ms: STREAM_IDLE_MS },
      body: {
        beginExclusive,
        endInclusive,
        updateFormat: {
          includeTransactions: {
            transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
            eventFormat: {
              verbose: true,
              ...templateFilter(partyId, this.contractTid),
            },
          },
        },
      },
    })
  }

  // The ledger keeps no claim log of its own, so the history is the transaction stream: every
  // `Contract_Claim` this party can see, read once rather than followed, since the page asks again
  // after each claim. The stream is party-wide, so the one grant's chain is picked out of it here
  // and no caller has to know a claim replaces the contract it is claimed from.
  async claimHistory(partyId: string, contractCid: string): Promise<ClaimRecord[]> {
    const endInclusive = await this.ledgerEnd()
    const records: ClaimRecord[] = []
    let beginExclusive: string | number = 0
    for (let page = 0; page < CLAIM_HISTORY_PAGES; page++) {
      const updates = await this.readUpdates(partyId, beginExclusive, endInclusive)
      records.push(...updatesToClaims(updates))
      const last = lastUpdateOffset(updates)
      if (!Array.isArray(updates) || updates.length < CLAIM_HISTORY_LIMIT || last === undefined) {
        break
      }
      beginExclusive = last
    }
    return claimChain(records, contractCid)
  }

  async accept(args: { receiver: string; proposalCid: string }): Promise<void> {
    await this.submit(args.receiver, buildAcceptCommand(this.proposalTid, args.proposalCid))
  }

  async withdraw(args: { receiver: string; contractCid: string; amount: string }): Promise<void> {
    await this.submit(
      args.receiver,
      buildClaimCommand(this.contractTid, args.contractCid, args.amount),
    )
  }

  async cancel(args: { creator: string; contractCid: string }): Promise<void> {
    await this.submit(args.creator, buildCancelCommand(this.contractTid, args.contractCid))
  }

  async claimResidual(args: { receiver: string; claimCid: string; amount: string }): Promise<void> {
    await this.submit(
      args.receiver,
      buildClaimResidualCommand(this.claimTid, args.claimCid, args.amount),
    )
  }
}
