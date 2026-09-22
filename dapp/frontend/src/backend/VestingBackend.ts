// The backend seam: the UI depends only on this interface and the domain types, never on DAML or
// transport details. The mappers below turn active contracts into those domain types.

import type { ActiveContract } from '@bootnodedev/canton-connect'
import { decodeSchedule } from '@/backend/commands'
import type { Grant, PartyId, PendingGrant, VestedClaim } from '@/store/types'
import { isAmount } from '@/utils/amount'
import type { VestingSchedule } from '@/utils/schedule'

export interface VestingView {
  claims: VestedClaim[]
  grants: Grant[]
  pendingGrants: PendingGrant[]
}

export interface CreateVestInput {
  note?: string
  proposer: string
  receiver: string
  schedule: VestingSchedule
  title: string
  totalAmount: string
}

// One `AmuletVestingContract_Withdraw` off the ledger: the amount and ledger time from the transaction, plus the
// two contract ids it sits between. `replaces` is what the claim consumed and `grant` what it
// created, so a caller can walk a grant's ancestry rather than match on fields two grants can share.
export interface ClaimRecord {
  amount: string
  at: string
  grant: Grant
  replaces: string
}

export interface VestingBackend {
  accept(args: { receiver: string; pendingCid: string }): Promise<void>
  balanceOf(partyId: string): Promise<string>
  cancel(args: { creator: string; contractCid: string }): Promise<void>
  claimHistory(partyId: string, contractCid: string): Promise<ClaimRecord[]>
  claimResidual(args: { receiver: string; claimCid: string; amount: string }): Promise<void>
  createVesting(args: CreateVestInput): Promise<void>
  tap(partyId: string): Promise<void>
  viewAs(partyId: string): Promise<VestingView>
  withdraw(args: { receiver: string; contractCid: string; amount: string }): Promise<void>
}

// A withdrawal consumes the contract and creates its successor, so one grant's history is its ancestry:
// walk back from the id asked about. Matching on the fields instead merges two grants a funder made
// identical, and the walk arrives newest-first, which is the order a caller wants to render.
export const claimChain = (records: ClaimRecord[], contractCid: string): ClaimRecord[] => {
  const bySuccessor = new Map(records.map((record) => [record.grant.id, record]))
  const chain: ClaimRecord[] = []
  for (
    let record = bySuccessor.get(contractCid);
    record !== undefined;
    record = bySuccessor.get(record.replaces)
  ) {
    chain.push(record)
  }
  return chain
}

// ── Domain-mapping convention ──────────────────────────────────────────────────
// On-ledger `note` is `"${title}\n${note}"`, decimals arrive as strings, and the curve as a
// JSON-LF variant. A contract read with no payload maps to undefined so it never crashes a view.

// The vesting fields the mappers read.
export type VestingPayload = {
  alreadyWithdrawn?: unknown
  amount?: unknown
  amuletCids?: unknown
  creator?: unknown
  note?: unknown
  proposer?: unknown
  provider?: unknown
  receiver?: unknown
  schedule?: unknown
  totalAmount?: unknown
  withdrawn?: unknown
}

// A Daml Numeric arrives as a string and is carried through unparsed, so ledger precision survives.
// Throws rather than let a surprise here fold into what looks like a real zero balance downstream.
const amountOf = (value: unknown, field: string, contractId: string): string => {
  if (typeof value !== 'string' || !isAmount(value)) {
    throw new Error(`Contract ${contractId} field '${field}' is not a Numeric string: ${value}`)
  }
  return value
}

const shortCid = (contractId: string): string => contractId.slice(0, 8)

// Compose the on-ledger note from a UI title + optional note. Mirror of splitNote.
export const composeNote = (title: string, note?: string): string =>
  note === undefined || note === '' ? title : `${title}\n${note}`

// Split the on-ledger note back into title + note, on the first newline only.
export const splitNote = (
  rawNote: unknown,
  contractId: string,
): { title: string; note?: string } => {
  const text = typeof rawNote === 'string' ? rawNote : ''
  const newlineAt = text.indexOf('\n')
  if (text === '') {
    return { title: `Vesting ${shortCid(contractId)}` }
  }
  if (newlineAt === -1) {
    return { title: text }
  }
  const title = text.slice(0, newlineAt)
  const note = text.slice(newlineAt + 1)
  return { title: title === '' ? `Vesting ${shortCid(contractId)}` : title, note }
}

// The fields every template carries alike; each mapper layers its own on top.
type DecodedBase = {
  arg: VestingPayload
  funder: PartyId
  id: string
  note?: string
  provider: PartyId
  receiver: PartyId
  title: string
}

// A payload the ledger left out must not crash a view.
const decodeBase = (
  contract: ActiveContract<VestingPayload | undefined>,
): DecodedBase | undefined => {
  const arg = contract.payload
  if (arg === undefined) {
    return undefined
  }
  const { title, note } = splitNote(arg.note, contract.contractId)
  return {
    arg,
    id: contract.contractId,
    title,
    note,
    provider: String(arg.provider ?? '') as PartyId,
    // The pending grant names the funder `proposer`; once accepted it is the contract's `creator`.
    funder: String(arg.creator ?? arg.proposer ?? '') as PartyId,
    receiver: String(arg.receiver ?? '') as PartyId,
  }
}

export const contractToPendingGrant = (
  contract: ActiveContract<VestingPayload>,
): PendingGrant | undefined => {
  const base = decodeBase(contract)
  if (base === undefined) {
    return undefined
  }
  return {
    id: base.id,
    title: base.title,
    provider: base.provider,
    proposer: base.funder,
    receiver: base.receiver,
    totalAmount: amountOf(base.arg.totalAmount, 'totalAmount', base.id),
    schedule: decodeSchedule(base.arg.schedule),
    note: base.note,
  }
}

export const contractToGrant = (contract: ActiveContract<VestingPayload>): Grant | undefined => {
  const base = decodeBase(contract)
  if (base === undefined) {
    return undefined
  }
  return {
    id: base.id,
    title: base.title,
    provider: base.provider,
    creator: base.funder,
    receiver: base.receiver,
    totalAmount: amountOf(base.arg.totalAmount, 'totalAmount', base.id),
    schedule: decodeSchedule(base.arg.schedule),
    alreadyWithdrawn: amountOf(base.arg.alreadyWithdrawn, 'alreadyWithdrawn', base.id),
    note: base.note,
  }
}

// A ledger-effects transaction, as `/v2/updates` returns it. Only the two events a claim produces
// are read: the exercise carries the amount, the create carries which grant it left behind.
type UpdateEntry = {
  update?: {
    Transaction?: {
      value?: {
        effectiveAt?: string
        events?: {
          CreatedEvent?: {
            contractId?: string
            createArgument?: Record<string, unknown>
            templateId?: string
          }
          ExercisedEvent?: {
            choice?: string
            choiceArgument?: Record<string, unknown>
            contractId?: string
          }
        }[]
        offset?: number
      }
    }
  }
}

// Where a page of updates ended, which is where the next one resumes.
export const lastUpdateOffset = (updates: unknown): number | undefined => {
  const entries = Array.isArray(updates) ? (updates as UpdateEntry[]) : []
  return entries.at(-1)?.update?.Transaction?.value?.offset
}

export const updatesToClaims = (updates: unknown): ClaimRecord[] =>
  (Array.isArray(updates) ? (updates as UpdateEntry[]) : []).flatMap((entry) => {
    const transaction = entry.update?.Transaction?.value
    const events = transaction?.events ?? []
    const claim = events.find(
      (event) => event.ExercisedEvent?.choice === 'AmuletVestingContract_Withdraw',
    )?.ExercisedEvent
    const created = events.find((event) => event.CreatedEvent !== undefined)?.CreatedEvent
    const amount = claim?.choiceArgument?.withdrawAmount
    const replaces = claim?.contractId
    if (
      created?.contractId === undefined ||
      created.templateId === undefined ||
      transaction?.effectiveAt === undefined ||
      amount === undefined ||
      replaces === undefined
    ) {
      return []
    }
    const grant = contractToGrant({
      contractId: created.contractId,
      templateId: created.templateId,
      payload: (created.createArgument ?? {}) as VestingPayload,
      createdEventBlob: undefined,
      synchronizerId: undefined,
    })
    return grant === undefined
      ? []
      : [
          {
            amount: amountOf(amount, 'amount', grant.id),
            at: transaction.effectiveAt,
            grant,
            replaces,
          },
        ]
  })

// The Amulet fields the mappers read.
export type AmuletPayload = { amount?: { initialAmount?: string }; dso?: string }

// What an Amulet is worth as a transfer input, which is its face value and not a decayed one:
// `summarizeAndConsumeInput` sums `initialAmount`, and the holding fee is charged only by
// `Amulet_Expire`. Lenient where the mappers above throw: this feeds a balance, and one odd
// contract must not blank the field.
export const amuletValue = (contract: ActiveContract<AmuletPayload>): string =>
  contract.payload?.amount?.initialAmount ?? '0'

// Read off a holding because a disclosure carries an opaque blob and no payload.
export const amuletDso = (contract: ActiveContract<AmuletPayload>): string | undefined =>
  contract.payload?.dso

// The Amulets a pending grant has already pledged: its Accept consumes exactly these, so nothing
// else may spend them while it is outstanding.
export const pledgedAmulets = (contract: ActiveContract<VestingPayload>): string[] => {
  const cids = contract.payload?.amuletCids
  return Array.isArray(cids) ? cids.map(String) : []
}

export const contractToClaim = (
  contract: ActiveContract<VestingPayload>,
): VestedClaim | undefined => {
  const base = decodeBase(contract)
  if (base === undefined) {
    return undefined
  }
  return {
    id: base.id,
    title: base.title,
    provider: base.provider,
    creator: base.funder,
    receiver: base.receiver,
    amount: amountOf(base.arg.amount, 'amount', base.id),
    withdrawn: amountOf(base.arg.withdrawn, 'withdrawn', base.id),
    note: base.note,
  }
}
