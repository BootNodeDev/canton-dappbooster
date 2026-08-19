// The backend seam: the UI depends only on this interface and the domain types, never on DAML or
// transport details. The mappers below turn active-contract rows into those domain types.

import { decodeSchedule } from '@/backend/commands'
import { isAmount } from '@/lib/amount'
import type { VestingSchedule } from '@/lib/schedule'
import type { Grant, PartyId, Proposal, VestedClaim } from '@/store/types'

export type PartyRef = { name: string; partyId: string }
export type Deployment = { pkg: string; operator: string }
export type Mode = 'lite'

export interface VestingView {
  grants: Grant[]
  proposals: Proposal[]
  claims: VestedClaim[]
}

export interface CreateVestInput {
  proposer: string
  receiver: string
  totalAmount: string
  schedule: VestingSchedule
  title: string
  note?: string
}

export interface VestingBackend {
  readonly mode: Mode
  isAvailable(): Promise<boolean>
  viewAs(partyId: string): Promise<VestingView>
  createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }>
  accept(args: { receiver: string; proposalCid: string }): Promise<void>
  withdraw(args: { receiver: string; contractCid: string; amount: string }): Promise<void>
  cancel(args: { creator: string; contractCid: string }): Promise<void>
  claimResidual(args: { receiver: string; claimCid: string; amount: string }): Promise<void>
}

// ── Domain-mapping convention ──────────────────────────────────────────────────
// On-ledger `note` is `"${title}\n${note}"`, decimals arrive as strings, and the curve as a
// JSON-LF variant. A row missing its createArgument maps to undefined so it never crashes a view.

type AcsRow = {
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
  id: string
  title: string
  note?: string
  provider: PartyId
  funder: PartyId
  receiver: PartyId
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
