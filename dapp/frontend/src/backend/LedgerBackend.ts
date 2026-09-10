// The VestingBackend over the canton-vesting-forge templates, reached through the connected wallet:
// reads go out as the connected party, writes come back with a real approval prompt.

import {
  buildAcceptCommand,
  buildCancelCommand,
  buildCancelProposalCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  buildRejectProposalCommand,
  buildTapCommand,
  buildWithdrawCommand,
} from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import {
  fetchInstrumentConfig,
  type InstrumentConfigRef,
  type RegistryInstrument,
} from '@/backend/registry'
import {
  type AcsRow,
  type ClaimRecord,
  type CreateVestInput,
  claimChain,
  composeNote,
  fundedBy,
  lastUpdateOffset,
  matchesInstrument,
  reservedToken,
  rowToClaim,
  rowToGrant,
  rowToPendingGrant,
  selectHoldings,
  tokenValue,
  updatesToClaims,
  type VestingBackend,
  type VestingView,
} from '@/backend/VestingBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'
import { addAmounts } from '@/utils/amount'

const mapRows = <T>(rows: AcsRow[], mapper: (row: AcsRow) => T | undefined): T[] =>
  rows.map(mapper).filter((value): value is T => value !== undefined)

// A filter takes the package-name reference; the participant rejects the resolved id a command
// carries with INVALID_FIELD.
const vesting = (entity: string): string => `#vesting:Vesting:${entity}`
const TOKEN = '#canton-token-forge:Canton.TokenForge.Token:Token'

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

// Accept locks the holding a grant reserves, which the receiver is no stakeholder of and so cannot
// read the disclosure blob for. It is kept here as the funder submits the pending grant. Persisted,
// because the two parties are two wallet accounts and switching between them reloads the app.
const TOKEN_STORE_KEY = 'vesting.tokenDisclosures'
// How often a reservation this browser cannot find is looked for again, counted across reloads. The
// read that answers it carries a blob per holding and runs on the funder's dashboard, so a holding
// archived outside this dApp would otherwise cost that read on every view forever, for a grant
// nobody can accept any more. Counted rather than given up on the first miss, because a read that
// answers short is indistinguishable from one that answers in full.
const MISS_STORE_KEY = 'vesting.tokenReadMisses'
const MISS_LIMIT = 3

// Shared by every exit that finds its proposal already gone, so the wording cannot drift between them.
const PROPOSAL_GONE_MESSAGE = 'this grant is no longer outstanding: reload to see where it went'

const storedTokens = (): DisclosedContract[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_STORE_KEY) ?? '[]')
    return Array.isArray(stored) ? (stored as DisclosedContract[]) : []
  } catch {
    return []
  }
}

const readMisses = (): Record<string, number> => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(MISS_STORE_KEY) ?? '{}')
    return typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, number>)
      : {}
  } catch {
    return {}
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

// The holdings this party's own outstanding grants reserve that this browser has neither a blob for
// nor given up on. Empty is the common answer, which is what lets the caller skip reading the
// holdings at all.
const unstoredReservations = (party: string, pendingRows: AcsRow[]): Set<string> => {
  const known = new Set(storedTokens().map((one) => one.contractId))
  const misses = readMisses()
  const reserved = mapRows(
    pendingRows.filter((row) => fundedBy(row, party)),
    reservedToken,
  )
  return new Set(
    reserved.filter(
      (contractId) => !known.has(contractId) && (misses[contractId] ?? 0) < MISS_LIMIT,
    ),
  )
}

// Merged by contract id rather than appended, because two reconciles can overlap, a dashboard
// refresh racing a fresh grant, and each computes what it is missing from a store snapshot taken
// before its own read. Answers with what it stored, which is what a miss is counted against.
const storeTokens = (held: AcsRow[], wanted: Set<string>): Set<string> => {
  const missing = mapRows(
    held.filter((row) => wanted.has(cidOf(row))),
    rowToDisclosed,
  )
  if (missing.length === 0) {
    return new Set()
  }
  const merged = new Map(storedTokens().map((one) => [one.contractId, one]))
  for (const one of missing) {
    merged.set(one.contractId, one)
  }
  localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify([...merged.values()]))
  return new Set(missing.map((one) => one.contractId))
}

// Counted against what was stored rather than against what came back, because a holding that
// arrives without its blob is as unusable as one that never arrived: calling it found would leave
// it wanted with no miss ever recorded, and so no bound on the read it costs.
const recordMisses = (wanted: Set<string>, stored: Set<string>): void => {
  const missed = [...wanted].filter((contractId) => !stored.has(contractId))
  if (missed.length === 0) {
    return
  }
  const misses = readMisses()
  const bumped = Object.fromEntries(missed.map((one) => [one, (misses[one] ?? 0) + 1]))
  const abandoned = Object.entries(bumped).filter(([, count]) => count === MISS_LIMIT)
  if (abandoned.length > 0) {
    console.warn(
      'giving up on the holdings these grants reserve: they cannot be accepted from this browser',
      abandoned.map(([contractId]) => contractId),
    )
  }
  localStorage.setItem(MISS_STORE_KEY, JSON.stringify({ ...misses, ...bumped }))
}

// What a grant leaves in this browser once it can no longer be accepted: the blob its Accept would
// have disclosed, and the count of reads spent looking for that holding. Both are keyed by the
// holding, so both go whichever way the grant ended. Every caller runs after its submission has
// landed, so a browser refusing to write must not turn a committed exit into a reported failure:
// what is left behind names a proposal that no longer exists and can only mislead a later Accept,
// which already says so on its own.
const forgetFunding = (tokenCid: string | undefined): void => {
  if (tokenCid === undefined) {
    return
  }
  try {
    localStorage.setItem(
      TOKEN_STORE_KEY,
      JSON.stringify(storedTokens().filter((one) => one.contractId !== tokenCid)),
    )
    const kept = Object.entries(readMisses()).filter(([contractId]) => contractId !== tokenCid)
    localStorage.setItem(MISS_STORE_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch (cause: unknown) {
    console.warn('could not forget what this browser kept for a grant that has ended', cause)
  }
}

export class LedgerBackend implements VestingBackend {
  private readonly wallet: WalletFns
  private readonly factory: DisclosedContract
  private readonly instrument: RegistryInstrument
  private readonly synchronizerId: string | undefined
  private readonly pkg: string

  constructor(deployment: Deployment, wallet: WalletFns) {
    this.wallet = wallet
    this.synchronizerId = deployment.synchronizerId
    this.pkg = deployment.pkg
    this.instrument = { admin: deployment.admin, instrumentId: deployment.instrumentId }
    this.factory = {
      templateId: this.tid('VestingFactory'),
      contractId: deployment.factoryCid,
      createdEventBlob: deployment.factoryBlob,
    }
  }

  // The resolved-id twin of `vesting()`: a command carries this spelling, a filter the other one.
  private tid(entity: string): string {
    return `${this.pkg}:Vesting:${entity}`
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
    // An answer that is not a list is a failure, not an empty ACS. Coercing it to `[]` made "this
    // party holds nothing" and "the read did not work" one answer, which is what left the reconcile
    // below unable to tell a reservation that is gone from one it simply failed to see.
    if (!Array.isArray(rows)) {
      throw new Error(`the participant did not answer ${templateId} with a list of contracts`)
    }
    return rows
  }

  // actAs is explicit rather than left to the wallet's primary account, so a submission that would
  // be signed by the wrong key is rejected by the participant instead of silently reassigned. The
  // synchronizer is stamped here and nowhere the disclosures are built, and on the submission as
  // well as on each disclosure: a write that discloses nothing would otherwise reach a wallet on
  // more than one synchronizer with none named, and land on its default.
  private submit(
    actAs: string,
    command: LedgerCommand,
    disclosed: DisclosedContract[],
    sync: string | undefined = this.synchronizerId,
  ): Promise<unknown> {
    return this.wallet.execute({
      actAs: [actAs],
      readAs: [actAs],
      commands: [command],
      ...(sync === undefined ? {} : { synchronizerId: sync }),
      disclosedContracts:
        sync === undefined ? disclosed : disclosed.map((one) => ({ ...one, synchronizerId: sync })),
    })
  }

  // What is free to fund a grant, and not simply what the party holds: a holding already escrowed is
  // a LockedToken and so out by template, and the holding an outstanding grant reserves is out
  // because spending it would leave that grant unacceptable. Offering more than this would put an
  // amount in the field that the next step always refuses.
  async balanceOf(partyId: string): Promise<string> {
    const free = await this.freeTokens(partyId)
    return addAmounts(...free.map(tokenValue))
  }

  async viewAs(partyId: string): Promise<VestingView> {
    // One ledger-end fetch for all three reads, so they share a consistent snapshot offset.
    const offset = await this.ledgerEnd()
    const [pendingGrantRows, contractRows, claimRows] = await Promise.all([
      this.readAcs(partyId, vesting('VestingProposal'), offset),
      this.readAcs(partyId, vesting('VestingContract'), offset),
      this.readAcs(partyId, vesting('VestedClaim'), offset),
    ])
    // The funder's own view is the one place a grant whose blob never got recorded is seen again,
    // so it is also where that is repaired: without it a funder who makes one grant and stops has
    // an unacceptable grant and no way to notice. A failure here must not blank the dashboard.
    await this.storeFunding(partyId, offset, pendingGrantRows).catch((cause: unknown) => {
      console.warn('could not read back the holdings this party’s grants reserve', cause)
    })
    return {
      pendingGrants: mapRows(this.ofInstrument(pendingGrantRows), rowToPendingGrant),
      grants: mapRows(this.ofInstrument(contractRows), rowToGrant),
      claims: mapRows(this.ofInstrument(claimRows), rowToClaim),
    }
  }

  // One submission, so one wallet approval: the factory splits the funder's inputs down to the grant
  // and hands the change back in the same transaction, so the funder never pre-splits the way the
  // Amulet version had to. The factory is the operator's and observer-less, so the funder cannot
  // read it and its disclosure comes from the deployment.
  async createVesting(args: CreateVestInput): Promise<void> {
    const free = await this.freeTokens(args.proposer)
    const picked = selectHoldings(free, args.totalAmount)
    if (picked === undefined) {
      throw new Error(
        `only ${addAmounts(...free.map(tokenValue))} ${this.instrument.instrumentId} is free to fund this grant`,
      )
    }
    await this.submitWithConfig(
      args.proposer,
      ({ configCid }) =>
        buildCreateVestingCommand(this.factory.templateId, this.factory.contractId, {
          configCid,
          proposer: args.proposer,
          receiver: args.receiver,
          totalAmount: args.totalAmount,
          schedule: args.schedule,
          tokenCids: picked.map(cidOf),
          note: composeNote(args.title, args.note),
        }),
      [this.factory],
    )
    // The grant is on the ledger by now, so a failure to record the blob must not report one: it
    // would invite the funder to make a second grant, and `accept` is where a missing blob is felt
    // and said. Logged rather than swallowed outright, because the next reconcile is what repairs
    // it and nothing else would say one was needed.
    await this.reconcileFunding(args.proposer).catch((cause: unknown) => {
      console.warn('could not read back the holding this grant reserves', cause)
    })
  }

  // The receiver has to disclose the holding a grant reserves, and only the funder can read it: a
  // `Token` has no observers. Every outstanding grant of this funder is reconciled rather than just
  // the one just made, so a read that failed once is repaired by their next grant or their next
  // dashboard load instead of leaving a grant nobody can accept. The holdings are read only when
  // something is actually missing, since this runs on every view, and a reservation the read keeps
  // not answering is given up on so that this cannot become a read on every view for good.
  private async storeFunding(
    party: string,
    offset: string | number,
    pendingRows: AcsRow[],
  ): Promise<void> {
    const wanted = unstoredReservations(party, pendingRows)
    if (wanted.size === 0) {
      return
    }
    const held = await this.readAcs(party, TOKEN, offset, true)
    // An empty read counts like any other: it is the answer a funder who no longer holds the
    // reservation gets, and it is the only one they ever get, so skipping it left the bound below
    // unreachable in exactly the case it exists for. `readAcs` throws rather than answering `[]` for
    // a reply it could not read, so this is the party's holdings and not a failure wearing them.
    recordMisses(wanted, storeTokens(held, wanted))
  }

  // Reconciles against a snapshot of its own, for a caller that has read no rows to hand over.
  // Taken after the submit, never before, because the factory creates the holding in that very
  // submission and a grant the wallet declined must leave no blob behind.
  private async reconcileFunding(party: string): Promise<void> {
    const offset = await this.ledgerEnd()
    const pendingRows = await this.readAcs(party, vesting('VestingProposal'), offset)
    await this.storeFunding(party, offset, pendingRows)
  }

  async tap(args: { amount: string; party: string }): Promise<void> {
    await this.submitWithConfig(args.party, ({ configCid, configTemplateId }) =>
      buildTapCommand(configTemplateId, configCid, { amount: args.amount, user: args.party }),
    )
  }

  // A transfer consumes every holding it is given, so the one an outstanding grant reserves has to
  // stay out: consuming it is exactly what leaves that grant unacceptable.
  private async freeTokens(owner: string): Promise<AcsRow[]> {
    const offset = await this.ledgerEnd()
    const [held, pendingRows] = await Promise.all([
      this.readAcs(owner, TOKEN, offset),
      this.readAcs(owner, vesting('VestingProposal'), offset),
    ])
    const reserved = new Set(pendingRows.map(reservedToken))
    return held.filter(
      (row) => matchesInstrument(row, this.instrument) && !reserved.has(cidOf(row)),
    )
  }

  private ofInstrument(rows: AcsRow[]): AcsRow[] {
    return rows.filter((row) => matchesInstrument(row, this.instrument))
  }

  // Every choice that moves a holding takes the same config and the same one disclosure, so the
  // invariant is held here rather than re-spelled per choice; `extra` is what only create and
  // Accept add. It answers with what it disclosed, which only create has a use for.
  private async submitWithConfig(
    actAs: string,
    build: (config: InstrumentConfigRef) => LedgerCommand,
    extra: DisclosedContract[] = [],
  ): Promise<DisclosedContract[]> {
    const { disclosed, synchronizerId, ...config } = await fetchInstrumentConfig(
      actAs,
      this.instrument,
    )
    const sent = [...disclosed, ...extra]
    await this.submit(actAs, build(config), sent, this.agreedSynchronizer(synchronizerId))
    return sent
  }

  // One submission names one synchronizer, and the two contracts it needs are stamped by two
  // different sources: the registry stamps the config it discloses, the deployment carries the
  // factory's. The app assumes they agree, so a disagreement is said here rather than sent as a
  // submission the participant refuses without naming either.
  private agreedSynchronizer(fromConfig: string | undefined): string | undefined {
    if (
      fromConfig !== undefined &&
      this.synchronizerId !== undefined &&
      fromConfig !== this.synchronizerId
    ) {
      throw new Error(
        `the registry's InstrumentConfig is on synchronizer ${fromConfig} and the vesting factory on ${this.synchronizerId}: this dApp needs both on one`,
      )
    }
    return this.synchronizerId ?? fromConfig
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
              ...templateFilter(partyId, vesting('VestingContract')),
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
      records.push(...updatesToClaims(updates, this.instrument))
      const last = lastUpdateOffset(updates)
      if (!Array.isArray(updates) || updates.length < CLAIM_HISTORY_LIMIT || last === undefined) {
        break
      }
      beginExclusive = last
    }
    return claimChain(records, contractCid)
  }

  // The grant names the holding its Accept locks, and the receiver is an observer of the grant, so
  // which blob to send is read off the ledger rather than guessed at. Sending the whole store
  // instead would re-disclose holdings earlier accepts already consumed, which the participant
  // rejects.
  async accept(args: { receiver: string; pendingCid: string }): Promise<void> {
    const proposal = await this.findProposal(args.receiver, args.pendingCid)
    // Two different failures, and pointing a stale view at the blob store would send the receiver
    // hunting for a browser that never had anything to do with it.
    if (proposal === undefined) {
      throw new Error(PROPOSAL_GONE_MESSAGE)
    }
    const wanted = reservedToken(proposal)
    const token = storedTokens().find((one) => one.contractId === wanted)
    if (wanted === undefined || token === undefined) {
      throw new Error('the funder holding this grant locks is not disclosable from this browser')
    }
    await this.submitWithConfig(
      args.receiver,
      ({ configCid }) =>
        buildAcceptCommand(this.tid('VestingProposal'), args.pendingCid, configCid),
      [token],
    )
    // The submission archived the proposal, so nothing this browser kept for it can do anything but
    // mislead a later Accept.
    forgetFunding(wanted)
  }

  // Neither exit moves anything, so neither takes the config or discloses a contract: the proposal
  // is archived on its controller's own authority and the holding it reserved is already an
  // ordinary Token of the funder's, back in their balance as soon as nothing names it.
  private endProposal(
    party: string,
    pendingCid: string,
    build: (templateId: string, pendingCid: string) => LedgerCommand,
  ): Promise<unknown> {
    return this.submit(party, build(this.tid('VestingProposal'), pendingCid), [])
  }

  // Read before the archive for the holding the proposal names, since reading it after would be too
  // late.
  async cancelProposal(args: { proposer: string; pendingCid: string }): Promise<void> {
    const proposal = await this.findProposal(args.proposer, args.pendingCid)
    if (proposal === undefined) {
      throw new Error(PROPOSAL_GONE_MESSAGE)
    }
    await this.endProposal(args.proposer, args.pendingCid, buildCancelProposalCommand)
    // Only once the submission has landed: a prompt the wallet declines leaves a grant that is
    // still outstanding and still acceptable.
    forgetFunding(reservedToken(proposal))
  }

  // The two parties are two accounts of one browser, so a grant this receiver declines can be one
  // this same browser funded and still holds the blob for. Read like the cancel above, but never
  // guarded on: the receiver is not who the prune is for, so a read that fails must cost them a
  // stale entry rather than a decline they cannot make.
  async rejectProposal(args: { receiver: string; pendingCid: string }): Promise<void> {
    const proposal = await this.findProposal(args.receiver, args.pendingCid).catch(() => undefined)
    await this.endProposal(args.receiver, args.pendingCid, buildRejectProposalCommand)
    forgetFunding(proposal === undefined ? undefined : reservedToken(proposal))
  }

  // One proposal by id, for the three exits that each need its row before archiving it: accept for
  // the holding to disclose, cancel and decline for the holding to forget.
  private async findProposal(party: string, pendingCid: string): Promise<AcsRow | undefined> {
    const offset = await this.ledgerEnd()
    const rows = await this.readAcs(party, vesting('VestingProposal'), offset)
    return rows.find((row) => cidOf(row) === pendingCid)
  }

  async withdraw(args: { receiver: string; contractCid: string; amount: string }): Promise<void> {
    await this.submitWithConfig(args.receiver, ({ configCid }) =>
      buildWithdrawCommand(this.tid('VestingContract'), args.contractCid, args.amount, configCid),
    )
  }

  async cancel(args: { creator: string; contractCid: string }): Promise<void> {
    await this.submitWithConfig(args.creator, ({ configCid }) =>
      buildCancelCommand(this.tid('VestingContract'), args.contractCid, configCid),
    )
  }

  async claimResidual(args: { receiver: string; claimCid: string; amount: string }): Promise<void> {
    await this.submitWithConfig(args.receiver, ({ configCid }) =>
      buildClaimResidualCommand(this.tid('VestedClaim'), args.claimCid, args.amount, configCid),
    )
  }
}
