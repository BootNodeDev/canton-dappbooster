import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  buildSplitCommand,
  buildTapCommand,
  buildWithdrawCommand,
} from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import { type AppTransferContext, fetchTransferContext } from '@/backend/transferContext'
import {
  type AcsRow,
  amuletDso,
  amuletValue,
  type ClaimRecord,
  type CreateVestInput,
  claimChain,
  composeNote,
  lastUpdateOffset,
  pledgedAmulets,
  rowToClaim,
  rowToGrant,
  rowToPendingGrant,
  updatesToClaims,
  type VestingBackend,
  type VestingView,
} from '@/backend/VestingBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'
import { addAmounts, canonicalAmount, compareAmounts } from '@/utils/amount'

const mapRows = <T>(rows: AcsRow[], mapper: (row: AcsRow) => T | undefined): T[] =>
  rows.map(mapper).filter((value): value is T => value !== undefined)

const vesting = (entity: string): string => `#amulet-vesting:AmuletVesting:${entity}`
const AMULET = '#splice-amulet:Splice.Amulet:Amulet'

const templateFilter = (
  party: string,
  templateId: string,
  includeCreatedEventBlob = false,
): Record<string, unknown> => ({
  filtersByParty: {
    [party]: {
      cumulative: [
        {
          identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob } } },
        },
      ],
    },
  },
})

const CLAIM_HISTORY_LIMIT = 1000
const STREAM_IDLE_MS = 1000
const CLAIM_HISTORY_PAGES = 20

const AMULET_STORE_KEY = 'vesting.amuletDisclosures'

const storedAmulets = (): DisclosedContract[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(AMULET_STORE_KEY) ?? '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
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

export class LedgerBackend implements VestingBackend {
  private readonly wallet: WalletFns
  private readonly factory: DisclosedContract
  private readonly synchronizerId: string | undefined
  private readonly pkg: string

  constructor(deployment: Deployment, wallet: WalletFns) {
    this.wallet = wallet
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
    includeCreatedEventBlob = false,
  ): Promise<AcsRow[]> {
    const rows = await this.wallet.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        filter: templateFilter(party, templateId, includeCreatedEventBlob),
        activeAtOffset: offset,
        verbose: true,
      },
    })
    return Array.isArray(rows) ? rows : []
  }

  private submit(
    actAs: string,
    command: LedgerCommand,
    disclosed: DisclosedContract[],
  ): Promise<unknown> {
    const sync = this.synchronizerId
    return this.wallet.execute({
      actAs: [actAs],
      readAs: [actAs],
      commands: [command],
      disclosedContracts:
        sync === undefined ? disclosed : disclosed.map((one) => ({ ...one, synchronizerId: sync })),
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
      pendingGrants: mapRows(pendingGrantRows, rowToPendingGrant),
      grants: mapRows(contractRows, rowToGrant),
      claims: mapRows(claimRows, rowToClaim),
    }
  }

  async createVesting(args: CreateVestInput): Promise<void> {
    const escrow = await this.splitOff(args.proposer, args.totalAmount)
    const command = buildCreateVestingCommand(this.factory.templateId, this.factory.contractId, {
      proposer: args.proposer,
      receiver: args.receiver,
      totalAmount: args.totalAmount,
      schedule: args.schedule,
      amuletCids: [escrow.contractId],
      note: composeNote(args.title, args.note),
    })
    await this.submit(args.proposer, command, [this.factory])
    localStorage.setItem(AMULET_STORE_KEY, JSON.stringify([...storedAmulets(), escrow]))
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
              ...templateFilter(partyId, vesting('AmuletVestingContract')),
            },
          },
        },
      },
    })
  }

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

  async accept(args: { receiver: string; pendingCid: string }): Promise<void> {
    const offset = await this.ledgerEnd()
    const rows = await this.readAcs(args.receiver, vesting('AmuletVestingProposal'), offset)
    const wanted = new Set(
      rows.filter((row) => cidOf(row) === args.pendingCid).flatMap(pledgedAmulets),
    )
    const amulets = storedAmulets().filter((amulet) => wanted.has(amulet.contractId))
    if (wanted.size === 0 || amulets.length !== wanted.size) {
      throw new Error('the funder Amulets this grant locks are not disclosable from this browser')
    }
    await this.submitWithContext(
      args.receiver,
      (ctx) => buildAcceptCommand(this.tid('AmuletVestingProposal'), args.pendingCid, ctx),
      amulets,
    )
    // The submission archived them, so their blobs can only mislead a later Accept from here on.
    localStorage.setItem(
      AMULET_STORE_KEY,
      JSON.stringify(storedAmulets().filter((amulet) => !wanted.has(amulet.contractId))),
    )
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

  // The only write not on an amulet-vesting template: it exercises AmuletRules itself.
  async tap(partyId: string): Promise<void> {
    await this.submitWithContext(partyId, (ctx, rulesTemplateId) =>
      buildTapCommand(rulesTemplateId, ctx.amuletRules, {
        openMiningRound: ctx.openMiningRound,
        receiver: partyId,
      }),
    )
  }
}
