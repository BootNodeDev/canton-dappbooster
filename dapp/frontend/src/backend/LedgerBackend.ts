// The VestingBackend over the amulet-vesting templates, reached through the connected wallet: reads
// go out as the connected party, writes come back with a real approval prompt.

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

// A filter takes the package-name reference; the participant rejects the resolved id a command
// carries with INVALID_FIELD.
const vesting = (entity: string): string => `#amulet-vesting:AmuletVesting:${entity}`
const AMULET = '#splice-amulet:Splice.Amulet:Amulet'

// The JSON Ledger API's party/template filter, shared by the ACS read and the update stream. Built
// in one place because a typo in this nesting yields a silent empty read rather than an error.
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

// A page of claims, and how long the stream may sit quiet before it returns what it has: the
// endpoint is a stream, so without the idle timeout the read never completes.
const CLAIM_HISTORY_LIMIT = 1000
const STREAM_IDLE_MS = 1000
// `limit` counts forward from `beginExclusive` and the endpoint offers no reverse order, so a party
// past one page keeps its oldest claims and loses the recent ones unless the pages are followed.
// Bounded so an offset that fails to advance cannot spin.
const CLAIM_HISTORY_PAGES = 20

// Accept locks the funder's Amulets, which the receiver is no stakeholder of and so cannot read the
// disclosure blobs for. They are kept here as the funder submits the pending grant. Persisted, because
// the two parties are two wallet accounts and switching between them reloads the app.
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

  // actAs is explicit rather than left to the wallet's primary account, so a submission that would
  // be signed by the wrong key is rejected by the participant instead of silently reassigned. The
  // synchronizer is a property of the submission, so it is stamped here and nowhere the disclosures
  // are built.
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

  // What is free to fund a grant, which is the same set `splitOff` will spend and not simply what
  // the party holds: coin already escrowed is a LockedAmulet and so out by template, and coin an
  // outstanding grant pledged is out because spending it would leave that grant unacceptable.
  // Offering more than this would put an amount in the field that the next step always refuses.
  async balanceOf(partyId: string): Promise<string> {
    const { free } = await this.freeAmulets(partyId)
    return addAmounts(...free.map(amuletValue))
  }

  async viewAs(partyId: string): Promise<VestingView> {
    // One ledger-end fetch for all three reads, so they share a consistent snapshot offset.
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

  // Two submissions, so two wallet approvals: a grant has to name an Amulet nothing else pledged,
  // and one Daml transaction cannot feed a contract that one command creates into the next. So the
  // funder splits exactly `totalAmount` off its unpledged holdings, and the grant names only what
  // the split produced. The factory is the operator's and observer-less, so the funder cannot read
  // it and its disclosure comes from the deployment; the blob size is what lets the UI surface that
  // mechanic.
  async createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }> {
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
    // After the submit, not before: a grant the wallet declined must not leave blobs behind for an
    // Amulet no grant is waiting on. Appended rather than replacing, because every outstanding
    // grant's own Amulet has to stay disclosable.
    localStorage.setItem(AMULET_STORE_KEY, JSON.stringify([...storedAmulets(), escrow]))
    return { disclosedBytes: this.factory.createdEventBlob.length }
  }

  // A transfer consumes everything it is given, so an Amulet an outstanding grant pledged has to
  // stay out of one: consuming it is exactly what leaves that grant unacceptable. `held` is the
  // whole set, which is what tells a later read which Amulets are new.
  private async freeAmulets(owner: string): Promise<{ free: AcsRow[]; held: AcsRow[] }> {
    const offset = await this.ledgerEnd()
    const [held, pendingRows] = await Promise.all([
      this.readAcs(owner, AMULET, offset),
      this.readAcs(owner, vesting('AmuletVestingProposal'), offset),
    ])
    const pledged = new Set(pendingRows.flatMap(pledgedAmulets))
    return { free: held.filter((row) => !pledged.has(cidOf(row))), held }
  }

  // Every Amulet-moving choice takes the same context and the same two disclosures, so the
  // invariant is held here rather than re-spelled per choice; `extra` is what only Accept adds.
  private async submitWithContext(
    actAs: string,
    build: (ctx: AppTransferContext, rulesTemplateId: string) => LedgerCommand,
    extra: DisclosedContract[] = [],
  ): Promise<void> {
    const { ctx, disclosed, rulesTemplateId } = await fetchTransferContext(actAs)
    await this.submit(actAs, build(ctx, rulesTemplateId), [...disclosed, ...extra])
  }

  // Self-transfers `amount` into an Amulet of the funder's own and returns it, disclosure blob
  // included. The result is found by re-reading rather than off the submission, which reports an
  // update id and nothing about what it created.
  private async splitOff(owner: string, amount: string): Promise<DisclosedContract> {
    const [{ free, held }, { ctx, disclosed, rulesTemplateId }] = await Promise.all([
      this.freeAmulets(owner),
      fetchTransferContext(owner),
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

    // The split archives every input, so anything of the right size that was not there before is
    // one of its two outputs and pledged to nothing.
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
              ...templateFilter(partyId, vesting('AmuletVestingContract')),
            },
          },
        },
      },
    })
  }

  // The ledger keeps no claim log of its own, so the history is the transaction stream: every
  // withdrawal this party can see, read once rather than followed, since the page asks again after
  // each one. The stream is party-wide, so the one grant's chain is picked out of it here and no
  // caller has to know a withdrawal replaces the contract it was taken from.
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

  // The grant names the Amulet its Accept locks, and the receiver is an observer of the grant, so
  // which blob to send is read off the ledger rather than guessed at. Sending the whole store
  // instead would re-disclose Amulets earlier accepts already consumed, and would leave the guard
  // below unable to tell a missing blob from an unrelated one.
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
