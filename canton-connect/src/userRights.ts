import type { LedgerApiParams } from '@canton-network/dapp-sdk'

/**
 * A right the participant grants the ledger user, `kind` in Canton's own naming. A party right
 * names its `party`; the others hold across the participant.
 *
 * @category Types
 */
export type UserRight =
  | { kind: 'CanActAs' | 'CanReadAs' | 'CanExecuteAs'; party: string }
  | {
      kind:
        | 'CanActAsAnyParty'
        | 'CanReadAsAnyParty'
        | 'CanExecuteAsAnyParty'
        | 'ParticipantAdmin'
        | 'IdentityProviderAdmin'
    }

type PartyRightKind = Extract<UserRight, { party: string }>['kind']

type RightRow = { kind?: Record<string, { value?: { party?: unknown } } | undefined> }

const NAMES_A_PARTY = {
  CanActAs: true,
  CanReadAs: true,
  CanExecuteAs: true,
  CanActAsAnyParty: false,
  CanReadAsAnyParty: false,
  CanExecuteAsAnyParty: false,
  ParticipantAdmin: false,
  IdentityProviderAdmin: false,
} as const satisfies Record<UserRight['kind'], boolean>

export const AUTHENTICATED_USER_REQUEST: LedgerApiParams = {
  requestMethod: 'get',
  resource: '/v2/authenticated-user',
}

export const userIdOf = (answer: unknown): string => {
  const id = (answer as { user?: { id?: unknown } } | null)?.user?.id
  if (typeof id !== 'string' || id === '') {
    throw new Error('ledger API returned no user for authenticated-user')
  }
  return id
}

export const userRightsRequest = (userId: string): LedgerApiParams => ({
  requestMethod: 'get',
  resource: '/v2/users/{user-id}/rights',
  path: { 'user-id': userId },
})

const isRightKind = (kind: string): kind is UserRight['kind'] => Object.hasOwn(NAMES_A_PARTY, kind)

const isPartyRightKind = (kind: UserRight['kind']): kind is PartyRightKind => NAMES_A_PARTY[kind]

// `Empty` is the unset oneof, not a right.
const decodeRight = (row: RightRow): UserRight | undefined => {
  const [kind, grant] = Object.entries(row.kind ?? {})[0] ?? []
  if (kind === undefined || !isRightKind(kind)) {
    return undefined
  }
  if (!isPartyRightKind(kind)) {
    return { kind }
  }
  const party = grant?.value?.party
  return typeof party === 'string' ? { kind, party } : undefined
}

export const decodeUserRights = (answer: unknown): UserRight[] => {
  const rights = (answer as { rights?: unknown } | null)?.rights
  return Array.isArray(rights) ? rights.flatMap((row: RightRow) => decodeRight(row) ?? []) : []
}
