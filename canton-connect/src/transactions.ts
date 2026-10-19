import type { LedgerCommonSchemas } from '@canton-network/core-ledger-client-types'
import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import {
  type ActiveContract,
  contractOf,
  type Decode,
  eventFormat,
  type LedgerPaths,
} from '#src/activeContracts'

/** A change to a template's active contracts: one created, or one archived. */
export type LedgerEvent<Payload> =
  | { kind: 'created'; contract: ActiveContract<Payload> }
  | { kind: 'archived'; contractId: string }

/** A committed transaction, cut down to what following a read needs. */
export type Transaction<Payload> = { offset: number; events: LedgerEvent<Payload>[] }

/** One follow's transactions, and the offset the next follow resumes after. */
export type TransactionsPage<Payload> = { transactions: Transaction<Payload>[]; cursor: number }

type UpdateEntry = LedgerCommonSchemas['JsGetUpdatesResponse']

type UpdatesQuery = LedgerPaths['/v2/updates']['post']['parameters']['query']

// Canton's default http-list-max-elements-limit: above it, a range holding more answers 413.
const PAGE_LIMIT = 200

export const transactionsRequest = (
  party: string,
  templateId: string,
  beginExclusive: number,
  endInclusive: number,
): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/updates' satisfies keyof LedgerPaths,
  // No stream_idle_timeout_ms: it cuts a bounded range too, and an empty cut reads as quiet.
  query: { limit: PAGE_LIMIT } satisfies UpdatesQuery,
  body: {
    beginExclusive,
    endInclusive,
    updateFormat: {
      includeTransactions: {
        // Stakeholders, as in the snapshot; ledger effects adds creates the party only witnessed.
        transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA',
        eventFormat: eventFormat(party, templateId),
      },
    },
  } satisfies LedgerCommonSchemas['GetUpdatesRequest'],
})

const decodeEvent = <Payload>(
  event: LedgerCommonSchemas['Event'],
  decode: Decode<Payload>,
): LedgerEvent<Payload> | undefined => {
  if ('CreatedEvent' in event) {
    const contract = contractOf(event.CreatedEvent, decode)

    return contract === undefined ? undefined : { kind: 'created', contract }
  }

  const contractId = 'ArchivedEvent' in event ? event.ArchivedEvent.contractId : undefined

  return contractId === undefined ? undefined : { kind: 'archived', contractId }
}

const decodeTransaction = <Payload>(
  { update }: UpdateEntry,
  decode: Decode<Payload>,
): Transaction<Payload> | undefined => {
  const transaction =
    update !== undefined && 'Transaction' in update ? update.Transaction.value : undefined

  return transaction?.offset === undefined
    ? undefined
    : {
        offset: transaction.offset,
        events: transaction.events.flatMap((event) => decodeEvent(event, decode) ?? []),
      }
}

// A reassignment or an offset checkpoint is not a transaction, so it is skipped.
export const decodeTransactions = <Payload>(
  updates: unknown,
  decode: Decode<Payload>,
): Transaction<Payload>[] =>
  Array.isArray(updates)
    ? updates.flatMap((entry: UpdateEntry) => decodeTransaction(entry, decode) ?? [])
    : []

// Only an empty answer proves the range quiet: at or under the participant's cap, a cut is silent.
export const decodeTransactionsPage = <Payload>(
  updates: unknown,
  decode: Decode<Payload>,
  beginExclusive: number,
  endInclusive: number,
): TransactionsPage<Payload> => {
  const transactions = decodeTransactions(updates, decode)
  const isQuiet = Array.isArray(updates) && updates.length === 0

  return {
    transactions,
    cursor: isQuiet ? endInclusive : (transactions.at(-1)?.offset ?? beginExclusive),
  }
}
