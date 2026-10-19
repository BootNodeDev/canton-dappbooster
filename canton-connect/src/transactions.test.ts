import type { LedgerCommonSchemas } from '@canton-network/core-ledger-client-types'
import { describe, expect, it } from 'vitest'
import { toGrant } from '#src/testing/grant'
import { archived, created, transactionUpdate } from '#src/testing/ledgerAnswers'
import { decodeTransactions, decodeTransactionsPage, transactionsRequest } from '#src/transactions'

const grant = { receiver: 'bob::1220' }

const checkpoint = (offset: number): LedgerCommonSchemas['JsGetUpdatesResponse'] => ({
  update: { OffsetCheckpoint: { value: { offset } } },
})

describe('transactionsRequest', () => {
  it('asks for one template in the stakeholder shape, from the cursor up to the given end', () => {
    expect(transactionsRequest('alice::1220', '#app:Main:Grant', 7, 9)).toEqual({
      requestMethod: 'post',
      resource: '/v2/updates',
      query: { limit: 200 },
      body: {
        beginExclusive: 7,
        endInclusive: 9,
        updateFormat: {
          includeTransactions: {
            transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA',
            eventFormat: {
              verbose: true,
              filtersByParty: {
                'alice::1220': {
                  cumulative: [
                    {
                      identifierFilter: {
                        TemplateFilter: {
                          value: { templateId: '#app:Main:Grant', includeCreatedEventBlob: false },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    })
  })
})

describe('decodeTransactions', () => {
  it('hands back each transaction offset with its events discriminated on kind', () => {
    const updates = [transactionUpdate(8, [archived('00aa'), created('00bb', grant)])]

    expect(decodeTransactions(updates, toGrant)).toEqual([
      {
        offset: 8,
        events: [
          { kind: 'archived', contractId: '00aa' },
          {
            kind: 'created',
            contract: {
              contractId: '00bb',
              templateId: 'pkg:Main:Grant',
              payload: { receiver: 'bob::1220' },
            },
          },
        ],
      },
    ])
  })

  it('skips reassignments, checkpoints and a transaction with no offset', () => {
    const reassignment: LedgerCommonSchemas['JsGetUpdatesResponse'] = {
      update: {
        Reassignment: {
          value: {
            updateId: 'r3',
            offset: 3,
            events: [],
            recordTime: '2026-10-19T12:00:00Z',
            synchronizerId: 'global-domain::1220',
          },
        },
      },
    }
    const noOffset = { update: { Transaction: { value: { events: [created('00aa', grant)] } } } }
    const updates = [
      reassignment,
      checkpoint(3),
      noOffset,
      transactionUpdate(8, [created('00bb', grant)]),
    ]

    const offsets = decodeTransactions(updates, toGrant).map((transaction) => transaction.offset)

    expect(offsets).toEqual([8])
  })

  it('drops an event it cannot name rather than the whole transaction', () => {
    const unnamed = { CreatedEvent: { contractId: '00bb' } }
    const [transaction] = decodeTransactions(
      [{ update: { Transaction: { value: { offset: 8, events: [unnamed, archived('00aa')] } } } }],
      toGrant,
    )

    expect(transaction?.events).toEqual([{ kind: 'archived', contractId: '00aa' }])
  })

  it('drops a create whose create argument its decode answers undefined for', () => {
    const refused = created('00bb', { owner: 'bob::1220' })
    const [transaction] = decodeTransactions(
      [transactionUpdate(8, [refused, archived('00aa')])],
      toGrant,
    )

    expect(transaction?.events).toEqual([{ kind: 'archived', contractId: '00aa' }])
  })

  it('returns nothing for an answer that is not a list', () => {
    expect(decodeTransactions(undefined, toGrant)).toEqual([])
    expect(decodeTransactions({ code: 'NOT_FOUND' }, toGrant)).toEqual([])
  })
})

describe('decodeTransactionsPage', () => {
  it('resumes after the end it read up to when the answer is empty', () => {
    expect(decodeTransactionsPage([], toGrant, 7, 12)).toEqual({ transactions: [], cursor: 12 })
  })

  it('resumes after the last transaction, since a page cut at its limit looks complete', () => {
    const updates = [
      transactionUpdate(8, [created('00aa', grant)]),
      transactionUpdate(9, [archived('00aa')]),
    ]

    expect(decodeTransactionsPage(updates, toGrant, 7, 12).cursor).toBe(9)
  })

  it('stays where it was when the answer holds no transaction', () => {
    expect(decodeTransactionsPage([checkpoint(11)], toGrant, 7, 12).cursor).toBe(7)
  })
})
