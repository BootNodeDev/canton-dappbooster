import { describe, expect, it } from 'vitest'
import {
  activeContractsByInterfaceRequest,
  activeContractsRequest,
  decodeActiveContracts,
  decodeInterfaceContracts,
  offsetOf,
  pageOf,
  toDisclosedContract,
} from '#src/activeContracts'

const row = (createdEvent: Record<string, unknown>, synchronizerId?: string) => ({
  contractEntry: { JsActiveContract: { createdEvent, synchronizerId } },
})

const grant = row(
  {
    contractId: '00aa',
    templateId: 'pkg:Main:Grant',
    createArgument: { receiver: 'bob::1220' },
    createdEventBlob: 'blob',
  },
  'global-domain::1220',
)

describe('offsetOf', () => {
  it('hands the offset through untouched', () => {
    expect(offsetOf({ offset: 42 })).toBe(42)
    expect(offsetOf({ offset: '42' })).toBe('42')
  })

  it('throws when the answer carries none', () => {
    expect(() => offsetOf({})).toThrow('no offset')
    expect(() => offsetOf(undefined)).toThrow('no offset')
  })
})

describe('activeContractsRequest', () => {
  it('asks for a page of one template as the party at the given offset, blob off unless asked', () => {
    const request = activeContractsRequest(['alice::1220'], 7, { templateId: '#app:Main:Grant' })

    expect(request).toEqual({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts-page',
      body: {
        activeAtOffset: 7,
        maxPageSize: 200,
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
    })
  })

  it('forwards the page token and filters every party given', () => {
    const request = activeContractsRequest(
      ['alice::1220', 'bob::1220'],
      7,
      { templateId: '#t' },
      'tok',
    )

    expect(request.body).toMatchObject({ pageToken: 'tok' })
    expect(
      Object.keys(
        (request.body as { eventFormat: { filtersByParty: object } }).eventFormat.filtersByParty,
      ),
    ).toEqual(['alice::1220', 'bob::1220'])
  })

  it('asks for the blob when told to', () => {
    const request = activeContractsRequest(['alice::1220'], 7, {
      templateId: '#app:Main:Grant',
      includeCreatedEventBlob: true,
    })

    expect(request.body).toMatchObject({
      eventFormat: {
        filtersByParty: {
          'alice::1220': {
            cumulative: [
              {
                identifierFilter: { TemplateFilter: { value: { includeCreatedEventBlob: true } } },
              },
            ],
          },
        },
      },
    })
  })
})

describe('activeContractsByInterfaceRequest', () => {
  it('filters the party by interface and asks for the view', () => {
    const request = activeContractsByInterfaceRequest(['alice::1220'], 7, {
      interfaceId: '#token:Holding',
    })

    expect(request.resource).toBe('/v2/state/active-contracts-page')
    expect(request.body).toMatchObject({
      activeAtOffset: 7,
      eventFormat: {
        filtersByParty: {
          'alice::1220': {
            cumulative: [
              {
                identifierFilter: {
                  InterfaceFilter: {
                    value: { interfaceId: '#token:Holding', includeInterfaceView: true },
                  },
                },
              },
            ],
          },
        },
      },
    })
  })
})

describe('pageOf', () => {
  it('hands back the page rows and the token for the next one', () => {
    expect(pageOf({ activeContracts: [grant], activeAtOffset: 7, nextPageToken: 'tok' })).toEqual({
      rows: [grant],
      nextPageToken: 'tok',
    })
  })

  it('reports the last page with no token, and nothing for an answer that is not a page', () => {
    expect(pageOf({ activeContracts: [grant] }).nextPageToken).toBeUndefined()
    expect(pageOf({ activeContracts: [], nextPageToken: '' }).nextPageToken).toBeUndefined()
    expect(pageOf(undefined)).toEqual({ rows: [], nextPageToken: undefined })
    expect(pageOf([grant])).toEqual({ rows: [], nextPageToken: undefined })
  })
})

describe('decodeInterfaceContracts', () => {
  const holding = (contractId: string, ...interfaceViews: unknown[]) =>
    row({ contractId, templateId: 'pkg:Amulet', createArgument: {}, interfaceViews })

  it('hands back the computed view of each contract', () => {
    const rows = [holding('00aa', { viewStatus: { code: 0 }, viewValue: { amount: '1' } })]

    expect(decodeInterfaceContracts<{ amount: string }>(rows)).toEqual([
      { contractId: '00aa', templateId: 'pkg:Amulet', view: { amount: '1' } },
    ])
  })

  it('drops a contract whose view the ledger could not compute', () => {
    const rows = [
      holding('00aa', { viewStatus: { code: 3, message: 'boom' } }),
      holding('00bb', { viewValue: { amount: '2' } }),
    ]

    expect(decodeInterfaceContracts(rows).map((one) => one.contractId)).toEqual(['00bb'])
  })

  it('drops a contract that carries no view at all', () => {
    expect(decodeInterfaceContracts([holding('00aa'), grant])).toEqual([])
  })
})

describe('decodeActiveContracts', () => {
  it('unwraps the envelope into contracts', () => {
    expect(decodeActiveContracts<{ receiver: string }>([grant])).toEqual([
      {
        contractId: '00aa',
        templateId: 'pkg:Main:Grant',
        payload: { receiver: 'bob::1220' },
        createdEventBlob: 'blob',
        synchronizerId: 'global-domain::1220',
      },
    ])
  })

  it('skips entries that are not active contracts', () => {
    const rows = [{ contractEntry: { JsIncompleteUnassigned: {} } }, {}, grant]

    expect(decodeActiveContracts(rows)).toHaveLength(1)
  })

  it('returns nothing for an answer that is not a list', () => {
    expect(decodeActiveContracts(undefined)).toEqual([])
    expect(decodeActiveContracts({ error: 'nope' })).toEqual([])
  })
})

describe('toDisclosedContract', () => {
  it('carries the blob and the synchronizer', () => {
    const [contract] = decodeActiveContracts([grant])

    expect(toDisclosedContract(contract)).toEqual({
      templateId: 'pkg:Main:Grant',
      contractId: '00aa',
      createdEventBlob: 'blob',
      synchronizerId: 'global-domain::1220',
    })
  })

  it('throws when the contract was read without its blob', () => {
    const [contract] = decodeActiveContracts([
      row({ contractId: '00aa', templateId: 'pkg:Main:Grant', createArgument: {} }),
    ])

    expect(() => toDisclosedContract(contract)).toThrow('includeCreatedEventBlob')
  })
})
