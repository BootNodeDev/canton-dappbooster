// LiteBackend: the VestingBackend over the vesting-lite DAML on the fast local
// stack, via the wallet-service ledgerApi proxy. Implements the VestingBackend
// interface against vesting-lite templates (residual claims, getTime,
// value-preserving cancel).

import type { DisclosedContract, LedgerCommand, Wallet } from '@/wallet/Wallet'
import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  buildDisclosedContract,
  extractCreatedEventBlob,
} from './commands'
import { walletServiceRequest } from './ledgerApi'
import {
  type CreateVestInput,
  composeNote,
  type Deployment,
  rowToClaim,
  rowToGrant,
  rowToProposal,
  type VestingBackend,
  type VestingView,
} from './VestingBackend'

export class LiteBackend implements VestingBackend {
  readonly mode = 'lite' as const
  private readonly rpcUrl: string
  private readonly wallet: Wallet
  private readonly operator: string
  private readonly factoryTid: string
  private readonly proposalTid: string
  private readonly contractTid: string
  private readonly claimTid: string

  constructor(rpcUrl: string, deployment: Deployment, wallet: Wallet) {
    this.rpcUrl = rpcUrl
    this.wallet = wallet
    this.operator = deployment.operator
    this.factoryTid = `${deployment.pkg}:Vesting:VestingFactory`
    this.proposalTid = `${deployment.pkg}:Vesting:VestingProposal`
    this.contractTid = `${deployment.pkg}:Vesting:VestingContract`
    this.claimTid = `${deployment.pkg}:Vesting:VestedClaim`
  }

  // Reachable if the ledger end responds. Pinging is enough; the bootstrap
  // guarantees the operator factory exists.
  async isAvailable(): Promise<boolean> {
    try {
      await this.ledgerEnd()
      return true
    } catch {
      return false
    }
  }

  private async ledgerEnd(): Promise<string | number> {
    const result = await walletServiceRequest<{ offset?: string | number }>(
      this.rpcUrl,
      'ledgerApi',
      { requestMethod: 'get', resource: '/v2/state/ledger-end' },
    )
    if (result.offset === undefined) {
      throw new Error('Ledger API did not return an offset')
    }
    return result.offset
  }

  private async readAcs(party: string, templateId: string): Promise<unknown[]> {
    const offset = await this.ledgerEnd()
    const rows = await walletServiceRequest<unknown>(this.rpcUrl, 'ledgerApi', {
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        filter: {
          filtersByParty: {
            [party]: {
              cumulative: [
                {
                  identifierFilter: {
                    TemplateFilter: {
                      value: { templateId, includeCreatedEventBlob: true },
                    },
                  },
                },
              ],
            },
          },
        },
        activeAtOffset: offset,
        verbose: true,
      },
    })
    return Array.isArray(rows) ? rows : []
  }

  private submit(
    actAs: string,
    command: LedgerCommand,
    disclosed?: DisclosedContract[],
  ): Promise<unknown> {
    return this.wallet.execute(actAs, command, disclosed)
  }

  async viewAs(partyId: string): Promise<VestingView> {
    const [proposalRows, contractRows, claimRows] = await Promise.all([
      this.readAcs(partyId, this.proposalTid),
      this.readAcs(partyId, this.contractTid),
      this.readAcs(partyId, this.claimTid),
    ])
    const proposals = proposalRows
      .map((row) => rowToProposal(row as Parameters<typeof rowToProposal>[0]))
      .filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== undefined)
    const grants = contractRows
      .map((row) => rowToGrant(row as Parameters<typeof rowToGrant>[0]))
      .filter((grant): grant is NonNullable<typeof grant> => grant !== undefined)
    const claims = claimRows
      .map((row) => rowToClaim(row as Parameters<typeof rowToClaim>[0]))
      .filter((claim): claim is NonNullable<typeof claim> => claim !== undefined)
    return { proposals, grants, claims }
  }

  // The proposer is not a stakeholder of the operator's factory, so it is delivered
  // via explicit disclosure. Returns the disclosed blob size so the UI can surface
  // the mechanic.
  async createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }> {
    const factoryRows = await this.readAcs(this.operator, this.factoryTid)
    const ref = factoryRows
      .map((row) => extractCreatedEventBlob(row as Parameters<typeof extractCreatedEventBlob>[0]))
      .find((candidate) => candidate !== undefined)
    if (ref === undefined) {
      throw new Error('operator factory not found — run the vest-lite bootstrap')
    }
    const command = buildCreateVestingCommand(this.factoryTid, ref.contractId, {
      proposer: args.proposer,
      beneficiary: args.receiver,
      total: args.totalAmount,
      schedule: args.schedule,
      note: composeNote(args.title, args.note),
    })
    await this.submit(args.proposer, command, [buildDisclosedContract(this.factoryTid, ref)])
    return { disclosedBytes: ref.createdEventBlob.length }
  }

  async accept(args: { receiver: string; proposalCid: string }): Promise<void> {
    await this.submit(args.receiver, buildAcceptCommand(this.proposalTid, args.proposalCid))
  }

  async withdraw(args: { receiver: string; contractCid: string; amount: number }): Promise<void> {
    await this.submit(
      args.receiver,
      buildClaimCommand(this.contractTid, args.contractCid, args.amount),
    )
  }

  async cancel(args: { creator: string; contractCid: string }): Promise<void> {
    await this.submit(args.creator, buildCancelCommand(this.contractTid, args.contractCid))
  }

  async claimResidual(args: { receiver: string; claimCid: string; amount: number }): Promise<void> {
    await this.submit(
      args.receiver,
      buildClaimResidualCommand(this.claimTid, args.claimCid, args.amount),
    )
  }
}
