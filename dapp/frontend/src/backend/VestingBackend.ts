// The backend seam: the UI depends only on this interface and the domain types, never on DAML or
// transport details. The mappers below turn active-contract rows into those domain types.

import { decodeSchedule } from '@/backend/commands'
import type { Grant, PartyId, Proposal, VestedClaim } from '@/store/types'
import { isAmount } from '@/utils/amount'
import type { VestingSchedule } from '@/utils/schedule'

export interface VestingView {
  claims: VestedClaim[]
  grants: Grant[]
  proposals: Proposal[]
}

export interface CreateVestInput {
  note?: string
  proposer: string
  receiver: string
  schedule: VestingSchedule
  title: string
  totalAmount: string
}

// One `Contract_Claim` off the ledger: the amount and ledger time from the transaction, plus the
// two contract ids it sits between. `replaces` is what the claim consumed and `grant` what it
// created, so a caller can walk a grant's ancestry rather than match on fields two grants can share.
export interface ClaimRecord {
  amount: string
  at: string
  grant: Grant
  replaces: string
}

export interface VestingBackend {
  accept(args: { receiver: string; proposalCid: string }): Promise<void>
  cancel(args: { creator: string; contractCid: string }): Promise<void>
  claimHistory(partyId: string): Promise<ClaimRecord[]>
  claimResidual(args: { receiver: string; claimCid: string; amount: string }): Promise<void>
  createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }>
  viewAs(partyId: string): Promise<VestingView>
  withdraw(args: { receiver: string; contractCid: string; amount: string }): Promise<void>
}

// ── Domain-mapping convention ──────────────────────────────────────────────────
// On-ledger `note` is `"${title}\n${note}"`, decimals arrive as strings, and the curve as a
// JSON-LF variant. A row missing its createArgument maps to undefined so it never crashes a view.

export type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: { contractId?: string; createArgument?: Record<string, unknown> }
    }
  }
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
  arg: Record<string, unknown>
  funder: PartyId
  id: string
  note?: string
  provider: PartyId
  receiver: PartyId
  title: string
}

const decodeBase = (row: AcsRow): DecodedBase | undefined => {
  const event = row.contractEntry?.JsActiveContract?.createdEvent
  const arg = event?.createArgument
  if (event?.contractId === undefined || arg === undefined) {
    return undefined
  }
  const { title, note } = splitNote(arg.note, event.contractId)
  return {
    arg,
    id: event.contractId,
    title,
    note,
    provider: String(arg.provider ?? '') as PartyId,
    funder: String(arg.proposer ?? '') as PartyId,
    receiver: String(arg.beneficiary ?? '') as PartyId,
  }
}

export const rowToProposal = (row: AcsRow): Proposal | undefined => {
  const base = decodeBase(row)
  if (base === undefined) {
    return undefined
  }
  return {
    id: base.id,
    title: base.title,
    provider: base.provider,
    proposer: base.funder,
    receiver: base.receiver,
    totalAmount: amountOf(base.arg.total, 'total', base.id),
    schedule: decodeSchedule(base.arg.schedule),
    note: base.note,
  }
}

export const rowToGrant = (row: AcsRow): Grant | undefined => {
  const base = decodeBase(row)
  if (base === undefined) {
    return undefined
  }
  return {
    id: base.id,
    title: base.title,
    provider: base.provider,
    creator: base.funder,
    receiver: base.receiver,
    totalAmount: amountOf(base.arg.total, 'total', base.id),
    schedule: decodeSchedule(base.arg.schedule),
    alreadyWithdrawn: amountOf(base.arg.claimed, 'claimed', base.id),
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
          CreatedEvent?: { contractId?: string; createArgument?: Record<string, unknown> }
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
      (event) => event.ExercisedEvent?.choice === 'Contract_Claim',
    )?.ExercisedEvent
    const created = events.find((event) => event.CreatedEvent !== undefined)?.CreatedEvent
    const amount = claim?.choiceArgument?.amount
    const replaces = claim?.contractId
    if (
      created === undefined ||
      transaction?.effectiveAt === undefined ||
      amount === undefined ||
      replaces === undefined
    ) {
      return []
    }
    const grant = rowToGrant({ contractEntry: { JsActiveContract: { createdEvent: created } } })
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

export const rowToClaim = (row: AcsRow): VestedClaim | undefined => {
  const base = decodeBase(row)
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
