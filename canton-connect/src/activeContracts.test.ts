import type { LedgerApiResult } from '@canton-network/dapp-sdk'
import { describe, expect, it } from 'vitest'
import {
  activeContractsRequest,
  decodeActiveContracts,
  offsetOf,
  pageOf,
} from '#src/activeContracts'
import { toGrant } from '#src/testing/grant'
import { acsRow } from '#src/testing/ledgerAnswers'

const grant = acsRow('00aa', { receiver: 'bob::1220' })

describe('offsetOf', () => {
  it('hands the offset back as the ledger reports it', () => {
    expect(offsetOf({ offset: 42 })).toBe(42)
  })

  it('throws when the answer carries none', () => {
    expect(() => offsetOf({})).toThrow('no offset')
    expect(() => offsetOf(undefined)).toThrow('no offset')
  })
})

describe('activeContractsRequest', () => {
  it('asks for a page of one template as the party at the given offset, without the blob', () => {
    expect(activeContractsRequest('alice::1220', '#app:Main:Grant', 7, undefined)).toEqual({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts-page',
      body: {
        activeAtOffset: 7,
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

  it('forwards the page token of the page before', () => {
    const request = activeContractsRequest('alice::1220', '#app:Main:Grant', 7, 'p2')

    expect(request.body).toMatchObject({ activeAtOffset: 7, pageToken: 'p2' })
  })
})

describe('pageOf', () => {
  it('hands back the rows and the token for the next page', () => {
    expect(pageOf({ activeContracts: [grant], activeAtOffset: 7, nextPageToken: 'p2' })).toEqual({
      activeContracts: [grant],
      nextPageToken: 'p2',
    })
  })

  it('reports the last page with no token, and no rows for an answer that is not a page', () => {
    const nullTokenPage: LedgerApiResult = { activeContracts: [grant], nextPageToken: null }
    const notAPage: LedgerApiResult = [grant]

    expect(pageOf({ activeContracts: [grant] }).nextPageToken).toBeUndefined()
    expect(pageOf(nullTokenPage).nextPageToken).toBeUndefined()
    expect(pageOf({ activeContracts: [], nextPageToken: '' }).nextPageToken).toBeUndefined()
    expect(pageOf(undefined)).toEqual({ activeContracts: [], nextPageToken: undefined })
    expect(pageOf(notAPage)).toEqual({ activeContracts: [], nextPageToken: undefined })
  })
})

describe('decodeActiveContracts', () => {
  it('unwraps each row into the contract and the payload its decode proved', () => {
    const [contract] = decodeActiveContracts(
      pageOf({ activeContracts: [grant] }).activeContracts,
      toGrant,
    )
    const receiver: string = contract.payload.receiver

    expect(contract).toEqual({
      contractId: '00aa',
      templateId: 'pkg:Main:Grant',
      payload: { receiver: 'bob::1220' },
    })
    expect(receiver).toBe('bob::1220')
  })

  it('skips a row that is not an active contract', () => {
    const answer: LedgerApiResult = {
      activeContracts: [{ contractEntry: { JsIncompleteUnassigned: {} } }, {}, grant],
    }

    expect(decodeActiveContracts(pageOf(answer).activeContracts, toGrant)).toHaveLength(1)
  })

  it('skips a create with no create argument, which the spec requires', () => {
    const createdEvent = { contractId: '00bb', templateId: 'pkg:Main:Grant' }
    const answer: LedgerApiResult = {
      activeContracts: [{ contractEntry: { JsActiveContract: { createdEvent } } }],
    }

    expect(decodeActiveContracts(pageOf(answer).activeContracts, toGrant)).toEqual([])
  })

  it('skips a contract whose create argument its decode answers undefined for', () => {
    const refused = acsRow('00bb', { owner: 'bob::1220' })
    const contracts = decodeActiveContracts(
      pageOf({ activeContracts: [refused, grant] }).activeContracts,
      toGrant,
    )

    expect(contracts.map((contract) => contract.contractId)).toEqual(['00aa'])
  })
})
