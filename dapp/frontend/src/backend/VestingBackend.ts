// The backend seam. The UI depends only on this interface + the domain types
// (@/store/types) — never on DAML/transport details. LiteBackend implements it
// against the vesting-lite DAML via the wallet-service ledgerApi proxy. The pure
// mappers here turn JSON-Ledger-API active-contract rows into Grant/Proposal/VestedClaim.

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
  totalAmount: number
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
  withdraw(args: { receiver: string; contractCid: string; amount: number }): Promise<void>
  cancel(args: { creator: string; contractCid: string }): Promise<void>
  claimResidual(args: { receiver: string; claimCid: string; amount: number }): Promise<void>
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

const num = (value: unknown): number => Number(value ?? 0)

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
    totalAmount: num(base.arg.total),
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
    totalAmount: num(base.arg.total),
    schedule: decodeSchedule(base.arg.schedule),
    alreadyWithdrawn: num(base.arg.claimed),
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
    amount: num(base.arg.amount),
    withdrawn: num(base.arg.withdrawn),
    note: base.note,
  }
}
