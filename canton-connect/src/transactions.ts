import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import {
  type ActiveContract,
  blobOf,
  filtersByParty,
  type LedgerOffset,
} from '#src/activeContracts'

/**
 * A contract the transaction created, as an active-contracts read returns it.
 *
 * @category Types
 */
export interface CreatedLedgerEvent<Payload = unknown> {
  kind: 'created'
  contract: ActiveContract<Payload>
}

/**
 * A choice the transaction exercised; `argument` and `result` are the choice's own types.
 *
 * @category Types
 */
export interface ExercisedLedgerEvent {
  kind: 'exercised'
  contractId: string
  templateId: string
  choice: string
  argument: unknown
  result: unknown
  consuming: boolean
}

/**
 * A contract the transaction archived.
 *
 * @category Types
 */
export interface ArchivedLedgerEvent {
  kind: 'archived'
  contractId: string
  templateId: string
}

/**
 * One transaction event, discriminated on `kind`.
 *
 * @category Types
 */
export type LedgerEvent<Payload = unknown> =
  | CreatedLedgerEvent<Payload>
  | ExercisedLedgerEvent
  | ArchivedLedgerEvent

/**
 * A committed transaction; `offset` is where the next page resumes.
 *
 * @category Types
 */
export interface Transaction<Payload = unknown> {
  updateId: string
  offset: number
  effectiveAt: string
  synchronizerId: string | undefined
  events: LedgerEvent<Payload>[]
}

/**
 * One template's transactions, `beginExclusive` to `endInclusive` (ledger start and end unless
 * given), at most `limit` of them, as the connected party unless `party` says otherwise.
 *
 * @example
 * await transactions({ templateId: '#my-app:Main:Grant', beginExclusive: lastPage.at(-1)?.offset })
 *
 * @category Types
 */
export interface TransactionsParams {
  templateId: string
  party?: string | string[]
  beginExclusive?: LedgerOffset
  endInclusive?: LedgerOffset
  limit?: number
}

/**
 * Who `transaction` reads as: the connected party unless `party` says otherwise.
 *
 * @example
 * await transaction(tx.payload.updateId, { party: operator })
 *
 * @category Types
 */
export interface TransactionParams {
  party?: string | string[]
}

const LEDGER_EFFECTS = 'TRANSACTION_SHAPE_LEDGER_EFFECTS'
const DEFAULT_LIMIT = 1000
// `endInclusive` bounds the stream; the idle timeout only guards one left open.
const STREAM_IDLE_MS = 1000

const updateFormat = (
  parties: string[],
  identifierFilter: Record<string, unknown>,
): Record<string, unknown> => ({
  includeTransactions: {
    transactionShape: LEDGER_EFFECTS,
    eventFormat: { verbose: true, filtersByParty: filtersByParty(parties, identifierFilter) },
  },
})

export const transactionsRequest = (
  parties: string[],
  endInclusive: LedgerOffset,
  { templateId, beginExclusive = 0, limit = DEFAULT_LIMIT }: TransactionsParams,
): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/updates',
  query: { limit, stream_idle_timeout_ms: STREAM_IDLE_MS },
  body: {
    beginExclusive,
    endInclusive,
    updateFormat: updateFormat(parties, {
      TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } },
    }),
  },
})

export const transactionRequest = (parties: string[], updateId: string): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/updates/update-by-id',
  body: {
    updateId,
    updateFormat: updateFormat(parties, {
      WildcardFilter: { value: { includeCreatedEventBlob: false } },
    }),
  },
})

type WireEvent = {
  CreatedEvent?: {
    contractId?: string
    templateId?: string
    createArgument?: unknown
    createdEventBlob?: string
  }
  ExercisedEvent?: {
    contractId?: string
    templateId?: string
    choice?: string
    choiceArgument?: unknown
    exerciseResult?: unknown
    consuming?: boolean
  }
  ArchivedEvent?: { contractId?: string; templateId?: string }
}

type WireTransaction = {
  updateId?: string
  offset?: number
  effectiveAt?: string
  synchronizerId?: string
  events?: WireEvent[]
}

type UpdateEntry = { update?: { Transaction?: { value?: WireTransaction } } }

const isPresent = <T>(value: T | undefined): value is T => value !== undefined

const decodeEvent = <Payload>(
  event: WireEvent,
  synchronizerId: string | undefined,
): LedgerEvent<Payload> | undefined => {
  const created = event.CreatedEvent
  if (created?.contractId !== undefined && created.templateId !== undefined) {
    return {
      kind: 'created',
      contract: {
        contractId: created.contractId,
        templateId: created.templateId,
        payload: created.createArgument as Payload,
        createdEventBlob: blobOf(created.createdEventBlob),
        synchronizerId,
      },
    }
  }
  const exercised = event.ExercisedEvent
  if (
    exercised?.contractId !== undefined &&
    exercised.templateId !== undefined &&
    exercised.choice !== undefined
  ) {
    return {
      kind: 'exercised',
      contractId: exercised.contractId,
      templateId: exercised.templateId,
      choice: exercised.choice,
      argument: exercised.choiceArgument,
      result: exercised.exerciseResult,
      consuming: exercised.consuming === true,
    }
  }
  const archived = event.ArchivedEvent
  if (archived?.contractId !== undefined && archived.templateId !== undefined) {
    return { kind: 'archived', contractId: archived.contractId, templateId: archived.templateId }
  }
  return undefined
}

const decodeWireTransaction = <Payload>(
  value: WireTransaction | undefined,
): Transaction<Payload> | undefined => {
  if (
    value?.updateId === undefined ||
    value.offset === undefined ||
    value.effectiveAt === undefined
  ) {
    return undefined
  }
  return {
    updateId: value.updateId,
    offset: value.offset,
    effectiveAt: value.effectiveAt,
    synchronizerId: value.synchronizerId,
    events: (value.events ?? [])
      .map((event) => decodeEvent<Payload>(event, value.synchronizerId))
      .filter(isPresent),
  }
}

// Reassignments and offset checkpoints are not transactions and are skipped.
export const decodeTransactions = <Payload>(updates: unknown): Transaction<Payload>[] =>
  Array.isArray(updates)
    ? updates
        .map((entry: UpdateEntry) =>
          decodeWireTransaction<Payload>(entry.update?.Transaction?.value),
        )
        .filter(isPresent)
    : []

export const decodeTransaction = <Payload>(answer: unknown): Transaction<Payload> | undefined =>
  decodeWireTransaction<Payload>((answer as UpdateEntry | null)?.update?.Transaction?.value)
