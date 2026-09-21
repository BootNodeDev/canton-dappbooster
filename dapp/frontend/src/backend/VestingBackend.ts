// The backend seam: the UI depends only on this interface and the domain types, never on DAML or
// transport details. The mappers below turn active-contract rows into those domain types.

import type { Optional, Serializable } from '@daml/types'
import { AmuletVesting } from '@daml.js/amulet-vesting-0.0.2'
import { Splice } from '@daml.js/splice-amulet-0.1.22'
import { decodeSchedule } from '@/backend/commands'
import type { Grant, PendingGrant, VestedClaim } from '@/store/types'
import { isAmount } from '@/utils/amount'
import type { VestingSchedule } from '@/utils/schedule'

const { AmuletVestedClaim, AmuletVestingContract, AmuletVestingProposal } = AmuletVesting
const withdrawChoice = AmuletVestingContract.AmuletVestingContract_Withdraw

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

// ── Row mapping ───────────────────────────────────────────────────────────────
// A row missing its createArgument maps to undefined so it never crashes a view.

export type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId?: string
        createArgument?: unknown
        createdEventBlob?: string
        templateId?: string
      }
    }
  }
}

// Throws rather than let an unparseable Numeric fold into what looks like a real zero downstream.
const amountOf = (value: string, field: string, contractId: string): string => {
  if (!isAmount(value)) {
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
  rawNote: Optional<string>,
  contractId: string,
): { title: string; note?: string } => {
  const text = rawNote ?? ''
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

type DecodedRow<T> = { id: string; payload: T }

const decodeRow = <T>(
  row: AcsRow,
  template: Serializable<T> & { templateId: string },
): DecodedRow<T> | undefined => {
  const event = row.contractEntry?.JsActiveContract?.createdEvent
  if (event?.contractId === undefined || event.createArgument === undefined) {
    return undefined
  }
  const decoded = template.decoder.run(event.createArgument)
  if (!decoded.ok) {
    throw new Error(
      `Contract ${event.contractId} is not a ${template.templateId}: ${decoded.error.at} ${decoded.error.message}`,
    )
  }
  return { id: event.contractId, payload: decoded.result }
}

export const rowToPendingGrant = (row: AcsRow): PendingGrant | undefined => {
  const decoded = decodeRow(row, AmuletVestingProposal)
  if (decoded === undefined) {
    return undefined
  }
  const { id, payload } = decoded
  const { title, note } = splitNote(payload.note, id)

  return {
    id,
    title,
    provider: payload.provider,
    proposer: payload.proposer,
    receiver: payload.receiver,
    totalAmount: amountOf(payload.totalAmount, 'totalAmount', id),
    schedule: decodeSchedule(payload.schedule),
    note,
  }
}

export const rowToGrant = (row: AcsRow): Grant | undefined => {
  const decoded = decodeRow(row, AmuletVestingContract)
  if (decoded === undefined) {
    return undefined
  }
  const { id, payload } = decoded
  const { title, note } = splitNote(payload.note, id)

  return {
    id,
    title,
    provider: payload.provider,
    creator: payload.creator,
    receiver: payload.receiver,
    totalAmount: amountOf(payload.totalAmount, 'totalAmount', id),
    schedule: decodeSchedule(payload.schedule),
    alreadyWithdrawn: amountOf(payload.alreadyWithdrawn, 'alreadyWithdrawn', id),
    note,
  }
}

export const rowToClaim = (row: AcsRow): VestedClaim | undefined => {
  const decoded = decodeRow(row, AmuletVestedClaim)
  if (decoded === undefined) {
    return undefined
  }
  const { id, payload } = decoded
  const { title, note } = splitNote(payload.note, id)

  return {
    id,
    title,
    provider: payload.provider,
    creator: payload.creator,
    receiver: payload.receiver,
    amount: amountOf(payload.amount, 'amount', id),
    withdrawn: amountOf(payload.withdrawn, 'withdrawn', id),
    note,
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
          CreatedEvent?: { contractId?: string; createArgument?: unknown }
          ExercisedEvent?: {
            choice?: string
            choiceArgument?: unknown
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

const updateToClaim = (entry: UpdateEntry): ClaimRecord[] => {
  const transaction = entry.update?.Transaction?.value
  const events = transaction?.events ?? []

  const claim = events.find(
    (event) => event.ExercisedEvent?.choice === withdrawChoice.choiceName,
  )?.ExercisedEvent
  const created = events.find((event) => event.CreatedEvent !== undefined)?.CreatedEvent
  const replaces = claim?.contractId
  if (
    created === undefined ||
    transaction?.effectiveAt === undefined ||
    claim?.choiceArgument === undefined ||
    replaces === undefined
  ) {
    return []
  }

  const grant = rowToGrant({ contractEntry: { JsActiveContract: { createdEvent: created } } })
  if (grant === undefined) {
    return []
  }
  const { withdrawAmount } = withdrawChoice.argumentDecoder.runWithException(claim.choiceArgument)

  return [
    {
      amount: amountOf(withdrawAmount, 'withdrawAmount', grant.id),
      at: transaction.effectiveAt,
      grant,
      replaces,
    },
  ]
}

export const updatesToClaims = (updates: unknown): ClaimRecord[] =>
  (Array.isArray(updates) ? (updates as UpdateEntry[]) : []).flatMap(updateToClaim)

// Lenient where the mappers above throw: this feeds a balance, and one odd row must not blank it.
const amuletPayload = (row: AcsRow): Splice.Amulet.Amulet | undefined => {
  const createArgument = row.contractEntry?.JsActiveContract?.createdEvent?.createArgument
  if (createArgument === undefined) {
    return undefined
  }
  const decoded = Splice.Amulet.Amulet.decoder.run(createArgument)
  return decoded.ok ? decoded.result : undefined
}

// Face value: Splice values an input at initialAmount, and only Amulet_Expire charges the fee.
export const amuletValue = (row: AcsRow): string => amuletPayload(row)?.amount.initialAmount ?? '0'

// Read off a holding because a disclosure carries an opaque blob and no payload.
export const amuletDso = (row: AcsRow): string | undefined => amuletPayload(row)?.dso

// The Amulets a pending grant has already pledged: its Accept consumes exactly these, so nothing
// else may spend them while it is outstanding.
export const pledgedAmulets = (row: AcsRow): string[] =>
  decodeRow(row, AmuletVestingProposal)?.payload.amuletCids ?? []
