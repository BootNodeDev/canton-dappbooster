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
  type CreateVestInput,
  composeNote,
  rowToClaim,
  rowToGrant,
  rowToProposal,
  type VestingBackend,
  type VestingView,
} from '@/backend/VestingBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'

const mapRows = <T>(rows: AcsRow[], mapper: (row: AcsRow) => T | undefined): T[] =>
  rows.map(mapper).filter((value): value is T => value !== undefined)

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
        filter: {
          filtersByParty: {
            [party]: {
              cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId } } } }],
            },
          },
        },
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
