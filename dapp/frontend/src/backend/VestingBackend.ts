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

type CreatedArg = { contractId: string; arg: Record<string, unknown> }

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

const created = (row: AcsRow): CreatedArg | undefined => {
  const event = row.contractEntry?.JsActiveContract?.createdEvent
  const arg = event?.createArgument
  if (event?.contractId === undefined || arg === undefined) {
    return undefined
  }
  return { contractId: event.contractId, arg }
}

export const rowToProposal = (row: AcsRow): Proposal | undefined => {
  const entry = created(row)
  if (entry === undefined) {
    return undefined
  }
  const { contractId, arg } = entry
  const { title, note } = splitNote(arg.note, contractId)
  return {
    id: contractId,
    title,
    provider: String(arg.provider ?? '') as PartyId,
    proposer: String(arg.proposer ?? '') as PartyId,
    receiver: String(arg.beneficiary ?? '') as PartyId,
    totalAmount: num(arg.total),
    schedule: decodeSchedule(arg.schedule),
    note,
  }
}

export const rowToGrant = (row: AcsRow): Grant | undefined => {
  const entry = created(row)
  if (entry === undefined) {
    return undefined
  }
  const { contractId, arg } = entry
  const { title, note } = splitNote(arg.note, contractId)
  return {
    id: contractId,
    title,
    provider: String(arg.provider ?? '') as PartyId,
    creator: String(arg.proposer ?? '') as PartyId,
    receiver: String(arg.beneficiary ?? '') as PartyId,
    totalAmount: num(arg.total),
    schedule: decodeSchedule(arg.schedule),
    alreadyWithdrawn: num(arg.claimed),
    note,
  }
}

export const rowToClaim = (row: AcsRow): VestedClaim | undefined => {
  const entry = created(row)
  if (entry === undefined) {
    return undefined
  }
  const { contractId, arg } = entry
  const { title, note } = splitNote(arg.note, contractId)
  return {
    id: contractId,
    title,
    provider: String(arg.provider ?? '') as PartyId,
    creator: String(arg.proposer ?? '') as PartyId,
    receiver: String(arg.beneficiary ?? '') as PartyId,
    amount: num(arg.amount),
    withdrawn: num(arg.withdrawn),
    note,
  }
}
