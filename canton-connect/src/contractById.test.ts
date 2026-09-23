import type { v3_5, v3_6 } from '@canton-network/core-ledger-client-types'
import { describe, expect, it } from 'vitest'
import type { LedgerOffset } from '#src/activeContracts'
import { contractByIdRequest, decodeContractById } from '#src/contractById'

// Every field the decoder reads must be one both specs still carry, at the type the decoder wants.
type Holds<T extends true> = T
type Floor = v3_5.components['schemas']['JsGetEventsByContractIdResponse']
type Latest = v3_6.components['schemas']['JsGetEventsByContractIdResponse']
type ReadCreate = {
  createdEvent: { contractId: string; templateId: string; createdEventBlob?: string }
  synchronizerId: string
}
type _FloorCreate = Holds<NonNullable<Floor['created']> extends ReadCreate ? true : false>
type _LatestCreate = Holds<NonNullable<Latest['created']> extends ReadCreate ? true : false>
type _ArchivalOffset = Holds<
  NonNullable<(Floor | Latest)['archived']>['archivedEvent']['offset'] extends LedgerOffset
    ? true
    : false
>

const CID = '00d4058d3cb526a477bbf7883efbbd19e3c1b97c8e1ce3c341ad66b2d6645b76ba'
const SYNC = 'global-domain::1220dfea'

const createdAnswer = {
  created: {
    createdEvent: {
      offset: 847,
      nodeId: 14,
      contractId: CID,
      templateId: 'pkg1:AmuletVesting:AmuletVestingContract',
      createArgument: { receiver: 'bob::1220' },
      createdEventBlob: 'blob',
    },
    synchronizerId: SYNC,
  },
  archived: null,
}

const wildcard = (includeCreatedEventBlob: boolean) => ({
  cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob } } } }],
})

describe('contractByIdRequest', () => {
  it('asks the route by name, filtering by every reading party and no template', () => {
    expect(contractByIdRequest(['alice::1220', 'bob::1220'], CID, {})).toEqual({
      requestMethod: 'post',
      resource: '/v2/events/events-by-contract-id',
      body: {
        contractId: CID,
        eventFormat: {
          verbose: true,
          filtersByParty: { 'alice::1220': wildcard(false), 'bob::1220': wildcard(false) },
        },
      },
    })
  })

  it('asks for the blob only where the caller wants a disclosure', () => {
    const body = contractByIdRequest(['alice::1220'], CID, { includeCreatedEventBlob: true })
      .body as { eventFormat: { filtersByParty: Record<string, unknown> } }

    expect(body.eventFormat.filtersByParty['alice::1220']).toEqual(wildcard(true))
  })
})

describe('decodeContractById', () => {
  it('reads an active contract with the synchronizer that sequenced its creation', () => {
    expect(decodeContractById<{ receiver: string }>(createdAnswer)).toEqual({
      contract: {
        contractId: CID,
        templateId: 'pkg1:AmuletVesting:AmuletVestingContract',
        payload: { receiver: 'bob::1220' },
        createdEventBlob: 'blob',
        synchronizerId: SYNC,
      },
      archivedOffset: undefined,
    })
  })

  it('still reads a contract the ledger has archived, reporting the offset it went at', () => {
    const answer = {
      ...createdAnswer,
      archived: {
        archivedEvent: { offset: 725, nodeId: 0, contractId: CID, templateId: 'pkg1:X:Y' },
        synchronizerId: SYNC,
      },
    }

    expect(decodeContractById(answer)?.archivedOffset).toBe(725)
  })

  it('reads the empty blob a participant sends for an unasked read as none', () => {
    const answer = {
      created: {
        createdEvent: { contractId: CID, templateId: 'pkg1:X:Y', createdEventBlob: '' },
        synchronizerId: SYNC,
      },
      archived: null,
    }

    expect(decodeContractById(answer)?.contract.createdEventBlob).toBeUndefined()
  })

  it('reports nothing where the create is pruned away, archival or not', () => {
    expect(decodeContractById({ created: null, archived: null })).toBeUndefined()
    expect(decodeContractById({ created: { createdEvent: { contractId: CID } } })).toBeUndefined()
    expect(decodeContractById(undefined)).toBeUndefined()
  })
})
