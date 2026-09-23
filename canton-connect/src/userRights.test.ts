import type { v3_5, v3_6 } from '@canton-network/core-ledger-client-types'
import { describe, expect, it } from 'vitest'
import { decodeUserRights, type UserRight, userIdOf, userRightsRequest } from '#src/userRights'

// Every kind the spec names must be one `UserRight` decodes, and nothing beyond them.
type KindsOf<Kind> = Exclude<Kind extends unknown ? keyof Kind : never, 'Empty'>
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Holds<T extends true> = T
type _CoversTheFloor = Holds<
  KindsOf<v3_5.components['schemas']['Kind']> extends UserRight['kind'] ? true : false
>
type _MatchesTheLatest = Holds<Same<KindsOf<v3_6.components['schemas']['Kind']>, UserRight['kind']>>

const OPERATOR = 'vesting-operator-1::1220ab'

describe('userIdOf', () => {
  it('reads the id off the authenticated user', () => {
    expect(userIdOf({ user: { id: 'ledger-api-user', primaryParty: 'app_user::1220' } })).toBe(
      'ledger-api-user',
    )
  })

  it('throws when the answer names no user', () => {
    expect(() => userIdOf({ user: {} })).toThrow('no user')
    expect(() => userIdOf({ user: { id: '' } })).toThrow('no user')
    expect(() => userIdOf(undefined)).toThrow('no user')
  })
})

describe('userRightsRequest', () => {
  it('names the route as its template, the id in `path`', () => {
    expect(userRightsRequest('ledger-api-user')).toEqual({
      requestMethod: 'get',
      resource: '/v2/users/{user-id}/rights',
      path: { 'user-id': 'ledger-api-user' },
    })
  })
})

describe('decodeUserRights', () => {
  it('names the party of a party right and nothing for a participant one', () => {
    const answer = {
      rights: [
        { kind: { CanActAs: { value: { party: OPERATOR } } } },
        { kind: { CanReadAs: { value: { party: OPERATOR } } } },
        { kind: { ParticipantAdmin: { value: {} } } },
      ],
    }

    expect(decodeUserRights(answer)).toEqual([
      { kind: 'CanActAs', party: OPERATOR },
      { kind: 'CanReadAs', party: OPERATOR },
      { kind: 'ParticipantAdmin' },
    ])
  })

  it('skips the unset kind, a kind it does not know, and a party right naming no party', () => {
    const answer = {
      rights: [
        { kind: { Empty: {} } },
        { kind: { CanSummonAs: { value: {} } } },
        { kind: { CanActAs: { value: {} } } },
        {},
      ],
    }

    expect(decodeUserRights(answer)).toEqual([])
  })

  it('returns nothing for an answer carrying no rights', () => {
    expect(decodeUserRights({})).toEqual([])
    expect(decodeUserRights(undefined)).toEqual([])
  })
})
