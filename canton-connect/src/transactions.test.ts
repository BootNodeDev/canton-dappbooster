import { describe, expect, it } from 'vitest'
import {
  decodeTransaction,
  decodeTransactions,
  transactionRequest,
  transactionsRequest,
} from '#src/transactions'

const committed = {
  updateId: 'u1',
  offset: 12,
  effectiveAt: '2026-03-01T00:00:00Z',
  synchronizerId: 'global-domain::1220',
  events: [
    {
      ExercisedEvent: {
        contractId: '00aa',
        templateId: 'pkg:Main:Grant',
        choice: 'Grant_Withdraw',
        choiceArgument: { amount: '5' },
        exerciseResult: { successor: '00bb' },
        consuming: true,
      },
    },
    {
      CreatedEvent: {
        contractId: '00bb',
        templateId: 'pkg:Main:Grant',
        createArgument: { receiver: 'bob::1220' },
      },
    },
    { ArchivedEvent: { contractId: '00cc', templateId: 'pkg:Main:Other' } },
  ],
}

const entry = (value: Record<string, unknown>) => ({ update: { Transaction: { value } } })

describe('transactionsRequest', () => {
  it('pages one template as the party, ledger effects, from the start to the given end', () => {
    const request = transactionsRequest(['alice::1220'], 40, { templateId: '#app:Main:Grant' })

    expect(request).toEqual({
      requestMethod: 'post',
      resource: '/v2/updates',
      query: { limit: 1000, stream_idle_timeout_ms: 1000 },
      body: {
        beginExclusive: 0,
        endInclusive: 40,
        updateFormat: {
          includeTransactions: {
            transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
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

  it('resumes from the offset and caps the page as told', () => {
    const request = transactionsRequest(['alice::1220', 'bob::1220'], 40, {
      templateId: '#app:Main:Grant',
      beginExclusive: 12,
      limit: 50,
    })
    const format = (
      request.body as {
        updateFormat: { includeTransactions: { eventFormat: { filtersByParty: object } } }
      }
    ).updateFormat

    expect(Object.keys(format.includeTransactions.eventFormat.filtersByParty)).toEqual([
      'alice::1220',
      'bob::1220',
    ])

    expect(request.query).toEqual({ limit: 50, stream_idle_timeout_ms: 1000 })
    expect(request.body).toMatchObject({ beginExclusive: 12, endInclusive: 40 })
  })
})

describe('transactionRequest', () => {
  it('asks for one update with everything the party sees', () => {
    const request = transactionRequest(['alice::1220'], 'u1')

    expect(request).toMatchObject({
      resource: '/v2/updates/update-by-id',
      body: {
        updateId: 'u1',
        updateFormat: {
          includeTransactions: {
            transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
            eventFormat: {
              filtersByParty: {
                'alice::1220': {
                  cumulative: [
                    {
                      identifierFilter: {
                        WildcardFilter: { value: { includeCreatedEventBlob: false } },
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
  it('unwraps each transaction and discriminates its events on kind', () => {
    expect(decodeTransactions([entry(committed)])).toEqual([
      {
        updateId: 'u1',
        offset: 12,
        effectiveAt: '2026-03-01T00:00:00Z',
        synchronizerId: 'global-domain::1220',
        events: [
          {
            kind: 'exercised',
            contractId: '00aa',
            templateId: 'pkg:Main:Grant',
            choice: 'Grant_Withdraw',
            argument: { amount: '5' },
            result: { successor: '00bb' },
            consuming: true,
          },
          {
            kind: 'created',
            contract: {
              contractId: '00bb',
              templateId: 'pkg:Main:Grant',
              payload: { receiver: 'bob::1220' },
              createdEventBlob: undefined,
              synchronizerId: 'global-domain::1220',
            },
          },
          { kind: 'archived', contractId: '00cc', templateId: 'pkg:Main:Other' },
        ],
      },
    ])
  })

  it('skips reassignments, checkpoints and transactions missing their identity', () => {
    const rows = [
      { update: { Reassignment: { value: {} } } },
      { update: { OffsetCheckpoint: { value: { offset: 3 } } } },
      entry({ ...committed, updateId: undefined }),
      entry(committed),
    ]

    expect(decodeTransactions(rows)).toHaveLength(1)
  })

  it('drops an event it cannot name rather than the whole transaction', () => {
    const [one] = decodeTransactions([
      entry({
        ...committed,
        events: [{ CreatedEvent: { contractId: '00bb' } }, committed.events[2]],
      }),
    ])

    expect(one?.events).toEqual([
      { kind: 'archived', contractId: '00cc', templateId: 'pkg:Main:Other' },
    ])
  })

  it('returns nothing for an answer that is not a list', () => {
    expect(decodeTransactions(undefined)).toEqual([])
    expect(decodeTransactions({ error: 'nope' })).toEqual([])
  })
})

describe('decodeTransaction', () => {
  it('unwraps the one update an update-by-id answer carries', () => {
    expect(decodeTransaction(entry(committed))?.updateId).toBe('u1')
  })

  it('is undefined for an update that is not a transaction', () => {
    expect(decodeTransaction({ update: { Reassignment: { value: {} } } })).toBeUndefined()
    expect(decodeTransaction(undefined)).toBeUndefined()
  })
})
