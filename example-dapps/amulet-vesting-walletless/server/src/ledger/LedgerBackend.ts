import { addAmounts, canonicalAmount, compareAmounts } from '#server/domain/amount'
import type { ClaimRecord, CreateVestInput, VestingView } from '#server/domain/types'
import { ledgerEnd, readAcs, templateFilter } from '#server/ledger/acs'
import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  buildSplitCommand,
  buildTapCommand,
  buildWithdrawCommand,
} from '#server/ledger/commands'
import type { Deployment } from '#server/ledger/config'
import {
  type AcsRow,
  amuletDso,
  amuletValue,
  claimChain,
  composeNote,
  pledgedAmulets,
  rowToClaim,
  rowToGrant,
  rowToPendingGrant,
  updatesToClaims,
} from '#server/ledger/mappers'
import { type AppTransferContext, fetchTransferContext } from '#server/ledger/transferContext'
import type { DisclosedContract, LedgerCommand, WalletFns } from '#server/ledger/wallet'

const vesting = (entity: string): string => `#amulet-vesting:AmuletVesting:${entity}`
const AMULET = '#splice-amulet:Splice.Amulet:Amulet'

// One page: a demo party's whole vesting history fits in it.
const CLAIM_HISTORY_LIMIT = 1000
// Without it, `/v2/updates` holds the response open waiting for new updates.
const STREAM_IDLE_MS = 1000

export interface DisclosureStore {
  drop(contractId: string): Promise<void>
  get(contractId: string): Promise<DisclosedContract | undefined>
  put(disclosed: DisclosedContract): Promise<void>
}

const cidOf = (row: AcsRow): string =>
  row.contractEntry?.JsActiveContract?.createdEvent?.contractId ?? ''

const rowToDisclosed = (row: AcsRow): DisclosedContract | undefined => {
  const { contractId, createdEventBlob, templateId } =
    row.contractEntry?.JsActiveContract?.createdEvent ?? {}
  return contractId === undefined || createdEventBlob === undefined || templateId === undefined
    ? undefined
    : { templateId, contractId, createdEventBlob }
}

export class LedgerBackend {
  private readonly wallet: WalletFns
  private readonly factory: DisclosedContract
  private readonly synchronizerId: string
  private readonly pkg: string
  private readonly disclosures: DisclosureStore

  constructor(deployment: Deployment, wallet: WalletFns, disclosures: DisclosureStore) {
    this.wallet = wallet
    this.disclosures = disclosures
    this.synchronizerId = deployment.synchronizerId
    this.pkg = deployment.pkg
    this.factory = {
      templateId: this.tid('AmuletVestingFactory'),
      contractId: deployment.factoryCid,
      createdEventBlob: deployment.factoryBlob,
    }
  }

  // The resolved-id twin of `vesting()`: a command carries this spelling, a filter the other one.
  private tid(entity: string): string {
    return `${this.pkg}:AmuletVesting:${entity}`
  }

  private ledgerEnd(): Promise<string | number> {
    return ledgerEnd(this.wallet.ledgerApi)
  }

  private readAcs(
    party: string,
    templateId: string,
    offset: string | number,
    includeCreatedEventBlob = false,
  ): Promise<AcsRow[]> {
    return readAcs<AcsRow>(
      this.wallet.ledgerApi,
      party,
      templateId,
      offset,
      includeCreatedEventBlob,
    )
  }

  private submit(
    actAs: string,
    command: LedgerCommand,
    disclosed: DisclosedContract[],
  ): Promise<unknown> {
    return this.wallet.execute({
      actAs: [actAs],
      readAs: [actAs],
      commands: [command],
      disclosedContracts: disclosed.map((one) => ({ ...one, synchronizerId: this.synchronizerId })),
    })
  }

  async balanceOf(partyId: string): Promise<string> {
    const { free } = await this.freeAmulets(partyId)
    return addAmounts(...free.map(amuletValue))
  }

  async viewAs(partyId: string): Promise<VestingView> {
    const offset = await this.ledgerEnd()
    const [pendingGrantRows, contractRows, claimRows] = await Promise.all([
      this.readAcs(partyId, vesting('AmuletVestingProposal'), offset),
      this.readAcs(partyId, vesting('AmuletVestingContract'), offset),
      this.readAcs(partyId, vesting('AmuletVestedClaim'), offset),
    ])
    return {
      pendingGrants: pendingGrantRows.map(rowToPendingGrant),
      grants: contractRows.map(rowToGrant),
      claims: claimRows.map(rowToClaim),
    }
  }

  async createVesting(proposer: string, args: CreateVestInput): Promise<void> {
    const escrow = await this.splitOff(proposer, args.totalAmount)
    const command = buildCreateVestingCommand(this.factory.templateId, this.factory.contractId, {
      proposer,
      receiver: args.receiver,
      totalAmount: args.totalAmount,
      schedule: args.schedule,
      amuletCids: [escrow.contractId],
      note: composeNote(args.title, args.note),
    })
    await this.submit(proposer, command, [this.factory])
    await this.disclosures.put(escrow)
  }

  private async freeAmulets(owner: string): Promise<{ free: AcsRow[]; held: AcsRow[] }> {
    const offset = await this.ledgerEnd()
    const [held, pendingRows] = await Promise.all([
      this.readAcs(owner, AMULET, offset),
      this.readAcs(owner, vesting('AmuletVestingProposal'), offset),
    ])
    const pledged = new Set(pendingRows.flatMap(pledgedAmulets))
    return { free: held.filter((row) => !pledged.has(cidOf(row))), held }
  }

  private async submitWithContext(
    actAs: string,
    build: (ctx: AppTransferContext, rulesTemplateId: string) => LedgerCommand,
    extra: DisclosedContract[] = [],
  ): Promise<void> {
    const { ctx, disclosed, rulesTemplateId } = await fetchTransferContext()
    await this.submit(actAs, build(ctx, rulesTemplateId), [...disclosed, ...extra])
  }

  private async splitOff(owner: string, amount: string): Promise<DisclosedContract> {
    const [{ free, held }, { ctx, disclosed, rulesTemplateId }] = await Promise.all([
      this.freeAmulets(owner),
      fetchTransferContext(),
    ])
    const freeTotal = addAmounts(...free.map(amuletValue))
    if (compareAmounts(freeTotal, amount) < 0) {
      throw new Error(
        `only ${freeTotal} AMT is free to fund this grant — the rest is pledged to a pending one`,
      )
    }
    const dso = free.map(amuletDso).find((party) => party !== undefined)
    if (dso === undefined) {
      throw new Error('the Amulets funding this grant name no DSO party')
    }

    await this.submit(
      owner,
      buildSplitCommand(rulesTemplateId, ctx.amuletRules, {
        amount,
        amuletCids: free.map(cidOf),
        dso,
        openMiningRound: ctx.openMiningRound,
        owner,
      }),
      disclosed,
    )

    const before = new Set(held.map(cidOf))
    const wanted = canonicalAmount(amount)
    const after = await this.readAcs(owner, AMULET, await this.ledgerEnd(), true)
    const created = after.find(
      (row) => !before.has(cidOf(row)) && canonicalAmount(amuletValue(row)) === wanted,
    )
    const disclosure = created === undefined ? undefined : rowToDisclosed(created)
    if (disclosure === undefined) {
      throw new Error('the split produced no Amulet of the grant amount')
    }
    return disclosure
  }

  async claimHistory(partyId: string, contractCid: string): Promise<ClaimRecord[]> {
    const updates = await this.wallet.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/updates',
      query: { limit: CLAIM_HISTORY_LIMIT, stream_idle_timeout_ms: STREAM_IDLE_MS },
      body: {
        beginExclusive: 0,
        endInclusive: await this.ledgerEnd(),
        updateFormat: {
          includeTransactions: {
            transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
            eventFormat: {
              verbose: true,
              ...templateFilter(partyId, vesting('AmuletVestingContract')),
            },
          },
        },
      },
    })
    return claimChain(updatesToClaims(updates), contractCid)
  }

  async accept(args: { receiver: string; pendingCid: string }): Promise<void> {
    const offset = await this.ledgerEnd()
    const rows = await this.readAcs(args.receiver, vesting('AmuletVestingProposal'), offset)
    const [pledged] = rows.filter((row) => cidOf(row) === args.pendingCid).flatMap(pledgedAmulets)
    const amulet = pledged === undefined ? undefined : await this.disclosures.get(pledged)
    if (pledged === undefined || amulet === undefined) {
      throw new Error('the funder Amulet this grant locks is not disclosable from this server')
    }
    await this.submitWithContext(
      args.receiver,
      (ctx) => buildAcceptCommand(this.tid('AmuletVestingProposal'), args.pendingCid, ctx),
      [amulet],
    )
    await this.disclosures.drop(pledged)
  }

  async withdraw(args: { receiver: string; contractCid: string; amount: string }): Promise<void> {
    await this.submitWithContext(args.receiver, (ctx) =>
      buildWithdrawCommand(this.tid('AmuletVestingContract'), args.contractCid, args.amount, ctx),
    )
  }

  async cancel(args: { creator: string; contractCid: string }): Promise<void> {
    await this.submitWithContext(args.creator, (ctx) =>
      buildCancelCommand(this.tid('AmuletVestingContract'), args.contractCid, ctx),
    )
  }

  async claimResidual(args: { receiver: string; claimCid: string; amount: string }): Promise<void> {
    await this.submitWithContext(args.receiver, (ctx) =>
      buildClaimResidualCommand(this.tid('AmuletVestedClaim'), args.claimCid, args.amount, ctx),
    )
  }

  async tap(partyId: string): Promise<void> {
    await this.submitWithContext(partyId, (ctx, rulesTemplateId) =>
      buildTapCommand(rulesTemplateId, ctx.amuletRules, {
        openMiningRound: ctx.openMiningRound,
        receiver: partyId,
      }),
    )
  }
}
