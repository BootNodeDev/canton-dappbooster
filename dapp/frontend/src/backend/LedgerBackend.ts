// The VestingBackend over the canton-vesting-forge templates, reached through the connected wallet:
// reads go out as the connected party, writes come back with a real approval prompt.

import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
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
  lastUpdateOffset,
  matchesInstrument,
  pledgedTokens,
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

// Accept locks the funder's holdings, which the receiver is no stakeholder of and so cannot read the
// disclosure blobs for. They are kept here as the funder submits the pending grant. Persisted,
// because the two parties are two wallet accounts and switching between them reloads the app.
const TOKEN_STORE_KEY = 'vesting.tokenDisclosures'

// Deduplicated here rather than on write, so a store already holding a holding twice recovers: two
// grants pledge the same one whenever the second ACS read lands before the first grant is indexed,
// and a duplicate would fail `accept`'s count guard for a grant whose blobs are all present.
const storedTokens = (): DisclosedContract[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_STORE_KEY) ?? '[]')
    const tokens: DisclosedContract[] = Array.isArray(stored) ? stored : []
    return [
      ...new Map<string, DisclosedContract>(
        tokens.map((token) => [token.contractId, token]),
      ).values(),
    ]
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

  // What is free to fund a grant, and not simply what the party holds: a holding already escrowed
  // is a LockedToken and so out by template, and a holding an outstanding grant pledged is out
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
    return {
      pendingGrants: mapRows(pendingGrantRows, rowToPendingGrant),
      grants: mapRows(this.ofInstrument(contractRows), rowToGrant),
      claims: mapRows(this.ofInstrument(claimRows), rowToClaim),
    }
  }

  // One submission, so one wallet approval. `executeTokenTransfer` returns the sender's leftover
  // input as change, so Accept splits the named holdings itself and the funder never pre-splits the
  // way the Amulet version had to. The factory is the operator's and observer-less, so the funder
  // cannot read it and its disclosure comes from the deployment; the blob size is what lets the UI
  // surface that mechanic.
  async createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }> {
    const free = await this.freeTokens(args.proposer, true)
    const picked = selectHoldings(free, args.totalAmount)
    if (picked === undefined) {
      throw new Error(
        `only ${addAmounts(...free.map(tokenValue))} ${this.instrument.instrumentId} is free to fund this grant`,
      )
    }
    const disclosures: DisclosedContract[] = []
    for (const row of picked) {
      const disclosure = rowToDisclosed(row)
      if (disclosure === undefined) {
        throw new Error('a holding funding this grant came back without its disclosure blob')
      }
      disclosures.push(disclosure)
    }
    const command = buildCreateVestingCommand(this.factory.templateId, this.factory.contractId, {
      proposer: args.proposer,
      receiver: args.receiver,
      totalAmount: args.totalAmount,
      schedule: args.schedule,
      tokenCids: picked.map(cidOf),
      note: composeNote(args.title, args.note),
    })
    await this.submit(args.proposer, command, [this.factory])
    // After the submit, not before: a grant the wallet declined must not leave blobs behind for
    // holdings no grant is waiting on. Appended rather than replacing, because every outstanding
    // grant's own holdings have to stay disclosable.
    localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify([...storedTokens(), ...disclosures]))
    return { disclosedBytes: this.factory.createdEventBlob.length }
  }

  async tap(args: { amount: string; party: string }): Promise<void> {
    await this.submitWithConfig(args.party, ({ configCid, configTemplateId }) =>
      buildTapCommand(configTemplateId, configCid, { amount: args.amount, user: args.party }),
    )
  }

  // A transfer consumes every holding it is given, so one an outstanding grant pledged has to stay
  // out: consuming it is exactly what leaves that grant unacceptable. Blobs are read only where a
  // caller will disclose them, since each is several hundred bytes the balance read has no use for.
  private async freeTokens(owner: string, includeBlobs = false): Promise<AcsRow[]> {
    const offset = await this.ledgerEnd()
    const [held, pendingRows] = await Promise.all([
      this.readAcs(owner, TOKEN, offset, includeBlobs),
      this.readAcs(owner, vesting('VestingProposal'), offset),
    ])
    const pledged = new Set(pendingRows.flatMap(pledgedTokens))
    return held.filter((row) => matchesInstrument(row, this.instrument) && !pledged.has(cidOf(row)))
  }

  // A pending grant is deliberately not filtered: VestingProposal carries no admin or instrumentId,
  // deriving both at Accept from a holding the receiver cannot read.
  private ofInstrument(rows: AcsRow[]): AcsRow[] {
    return rows.filter((row) => matchesInstrument(row, this.instrument))
  }

  // Every choice that moves a holding takes the same config and the same one disclosure, so the
  // invariant is held here rather than re-spelled per choice; `extra` is what only Accept adds.
  private async submitWithConfig(
    actAs: string,
    build: (config: InstrumentConfigRef) => LedgerCommand,
    extra: DisclosedContract[] = [],
  ): Promise<void> {
    const { disclosed, ...config } = await fetchInstrumentConfig(actAs, this.instrument)
    await this.submit(actAs, build(config), [...disclosed, ...extra])
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

  // The grant names the holdings its Accept locks, and the receiver is an observer of the grant, so
  // which blobs to send is read off the ledger rather than guessed at. Sending the whole store
  // instead would re-disclose holdings earlier accepts already consumed, and would leave the guard
  // below unable to tell a missing blob from an unrelated one.
  async accept(args: { receiver: string; pendingCid: string }): Promise<void> {
    const offset = await this.ledgerEnd()
    const rows = await this.readAcs(args.receiver, vesting('VestingProposal'), offset)
    const wanted = new Set(
      rows.filter((row) => cidOf(row) === args.pendingCid).flatMap(pledgedTokens),
    )
    const tokens = storedTokens().filter((token) => wanted.has(token.contractId))
    if (wanted.size === 0 || tokens.length !== wanted.size) {
      throw new Error('the funder holdings this grant locks are not disclosable from this browser')
    }
    await this.submitWithConfig(
      args.receiver,
      ({ configCid }) =>
        buildAcceptCommand(this.tid('VestingProposal'), args.pendingCid, configCid),
      tokens,
    )
    // The submission archived them, so their blobs can only mislead a later Accept from here on.
    localStorage.setItem(
      TOKEN_STORE_KEY,
      JSON.stringify(storedTokens().filter((token) => !wanted.has(token.contractId))),
    )
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
