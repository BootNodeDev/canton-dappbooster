// The backend seam. The UI depends only on this interface + the domain types
// (@/store/types) — never on DAML/transport details. LiteBackend implements it
// against the vesting-lite DAML via the wallet-service ledgerApi proxy. The pure
// mappers here turn JSON-Ledger-API active-contract rows into Grant/Proposal/VestedClaim.

import { isAmount } from '@/lib/amount'
import type { VestingSchedule } from '@/lib/schedule'
import type { Grant, PartyId, Proposal, VestedClaim } from '@/store/types'
import { decodeSchedule } from './commands'

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
// On-ledger `note` carries `"${title}\n${note}"`; we split on the FIRST newline →
// title (fallback `Vesting ${shortCid}`) + note. `id` = contractId. The DAML
// `proposer` is the UI `creator`/`proposer` (funder); DAML `beneficiary` is the UI
// `receiver`. Decimals arrive as strings; the schedule curve as a JSON-LF variant
// (decodeSchedule). Each mapper tolerates a missing createArgument (returns
// undefined) so a stray row never crashes a view.

type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: { contractId?: string; createArgument?: Record<string, unknown> }
    }
  }
}

// A Daml Numeric arrives as a string over the JSON Ledger API — carried through unparsed to keep
// exact ledger precision. Throws rather than silently zeroing: a shape surprise on an amount field
// must not fold into a figure that looks like a real zero balance. The value is checked as well as
// the shape, because a string this app cannot parse (`'1e3'`, `'-5'`, `''`) folds to zero all the
// same once it reaches `lib/amount.ts`.
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

// Shared decode: guard the row, split the note, and pull the fields every template
// carries the same way (id, title/note, provider, funder=proposer, receiver=beneficiary).
// Each mapper layers its template-specific fields on top.
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
