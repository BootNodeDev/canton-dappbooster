import type { v3_5, v3_6 } from '@canton-network/core-ledger-client-types'
import { describe, expect, it } from 'vitest'
import {
  type ConnectedSynchronizer,
  connectedSynchronizersRequest,
  decodeConnectedSynchronizers,
  type ParticipantPermission,
} from '#src/connectedSynchronizers'

// The spec's permissions must be exactly the ones declared, and its row must fit the decoded one.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Holds<T extends true> = T
type SpecRow<Schemas> = Schemas extends { ConnectedSynchronizer: infer Row } ? Row : never
type SpecPermission<Schemas> = NonNullable<
  SpecRow<Schemas> extends { permission?: infer P } ? P : never
>
type _FloorPermissions = Holds<
  Same<SpecPermission<v3_5.components['schemas']>, ParticipantPermission>
>
type _LatestPermissions = Holds<
  Same<SpecPermission<v3_6.components['schemas']>, ParticipantPermission>
>
type _RowFits = Holds<
  Omit<SpecRow<v3_6.components['schemas']>, 'permission'> extends Omit<
    ConnectedSynchronizer,
    'permission'
  >
    ? true
    : false
>

const GLOBAL = 'global-domain::1220dfea'

describe('connectedSynchronizersRequest', () => {
  it('asks the route by name and passes the party as a query parameter', () => {
    expect(connectedSynchronizersRequest('alice::1220')).toEqual({
      requestMethod: 'get',
      resource: '/v2/state/connected-synchronizers',
      query: { party: 'alice::1220' },
    })
  })
})

describe('decodeConnectedSynchronizers', () => {
  it('hands back each synchronizer with its alias and the permission the party holds there', () => {
    const answer = {
      connectedSynchronizers: [
        {
          synchronizerAlias: 'global',
          synchronizerId: GLOBAL,
          permission: 'PARTICIPANT_PERMISSION_CONFIRMATION',
        },
      ],
    }

    expect(decodeConnectedSynchronizers(answer)).toEqual([
      {
        synchronizerId: GLOBAL,
        synchronizerAlias: 'global',
        permission: 'PARTICIPANT_PERMISSION_CONFIRMATION',
      },
    ])
  })

  it('leaves out a permission it does not know rather than passing it through', () => {
    const answer = {
      connectedSynchronizers: [
        {
          synchronizerAlias: 'global',
          synchronizerId: GLOBAL,
          permission: 'PARTICIPANT_PERMISSION_OWNER',
        },
        { synchronizerAlias: 'other', synchronizerId: 'other::1220' },
      ],
    }

    expect(decodeConnectedSynchronizers(answer).map((one) => one.permission)).toEqual([
      undefined,
      undefined,
    ])
  })

  it('skips an entry missing its id or alias', () => {
    const answer = {
      connectedSynchronizers: [{ synchronizerAlias: 'global' }, { synchronizerId: GLOBAL }, {}],
    }

    expect(decodeConnectedSynchronizers(answer)).toEqual([])
  })

  it('returns nothing for an answer carrying no list', () => {
    expect(decodeConnectedSynchronizers({})).toEqual([])
    expect(decodeConnectedSynchronizers(undefined)).toEqual([])
  })
})
