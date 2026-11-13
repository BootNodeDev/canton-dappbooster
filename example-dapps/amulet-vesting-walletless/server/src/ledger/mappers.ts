import { isAmount } from '#server/domain/amount'
import type { ClaimRecord, Grant, PartyId, PendingGrant, VestedClaim } from '#server/domain/types'
import { decodeSchedule } from '#server/ledger/commands'

// Walks ids, not fields: two grants a funder made identical share every field.
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

export type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId?: string
        createArgument?: Record<string, unknown>
        createdEventBlob?: string
        templateId?: string
      }
    }
  }
}

// Throws rather than fold a bad value into what reads as a real zero balance downstream.
const amountOf = (value: unknown, field: string, contractId: string): string => {
  if (typeof value !== 'string' || !isAmount(value)) {
    throw new Error(`Contract ${contractId} field '${field}' is not a Numeric string: ${value}`)
  }
  return value
}

const shortCid = (contractId: string): string => contractId.slice(0, 8)

// The Daml model has no title field, so the title rides on the note's first line.
export const composeNote = (title: string, note?: string): string =>
  note === undefined || note === '' ? title : `${title}\n${note}`

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

type DecodedBase = {
  arg: Record<string, unknown>
  funder: PartyId
  id: string
  note?: string
  provider: PartyId
  receiver: PartyId
  title: string
}

type CreatedEvent = { contractId: string; createArgument: Record<string, unknown> }

const decodeBase = (row: AcsRow): DecodedBase => {
  const { contractId, createArgument: arg } = (row.contractEntry?.JsActiveContract?.createdEvent ??
    {}) as CreatedEvent
  const { title, note } = splitNote(arg.note, contractId)
  return {
    arg,
    id: contractId,
    title,
    note,
    provider: String(arg.provider ?? '') as PartyId,
    funder: String(arg.creator ?? arg.proposer ?? '') as PartyId,
    receiver: String(arg.receiver ?? '') as PartyId,
  }
}

export const rowToPendingGrant = (row: AcsRow): PendingGrant => {
  const base = decodeBase(row)
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

export const rowToGrant = (row: AcsRow): Grant => {
  const base = decodeBase(row)
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
      created === undefined ||
      transaction?.effectiveAt === undefined ||
      amount === undefined ||
      replaces === undefined
    ) {
      return []
    }
    const grant = rowToGrant({ contractEntry: { JsActiveContract: { createdEvent: created } } })
    return [
      {
        amount: amountOf(amount, 'amount', grant.id),
        at: transaction.effectiveAt,
        grant,
        replaces,
      },
    ]
  })

type AmuletArg = { amount?: { initialAmount?: string }; dso?: string }

// Face value: Splice sums `initialAmount` and charges the holding fee only in `Amulet_Expire`.
export const amuletValue = (row: AcsRow): string => {
  const { amount } = (row.contractEntry?.JsActiveContract?.createdEvent?.createArgument ??
    {}) as AmuletArg
  // Lenient where the mappers above throw: one odd row must not blank a balance.
  return amount?.initialAmount ?? '0'
}

// Read off a holding because a disclosure carries an opaque blob and no payload.
export const amuletDso = (row: AcsRow): string | undefined =>
  (row.contractEntry?.JsActiveContract?.createdEvent?.createArgument as AmuletArg | undefined)?.dso

// Accept consumes exactly these, so nothing else may spend them while the grant is pending.
export const pledgedAmulets = (row: AcsRow): string[] => {
  const cids = row.contractEntry?.JsActiveContract?.createdEvent?.createArgument?.amuletCids
  return Array.isArray(cids) ? cids.map(String) : []
}

export const rowToClaim = (row: AcsRow): VestedClaim => {
  const base = decodeBase(row)
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
