import type { LedgerApiParams } from '@canton-network/dapp-sdk'

/**
 * What the participant may do for the party on one synchronizer.
 *
 * @category Types
 */
export type ParticipantPermission =
  | 'PARTICIPANT_PERMISSION_SUBMISSION'
  | 'PARTICIPANT_PERMISSION_CONFIRMATION'
  | 'PARTICIPANT_PERMISSION_OBSERVATION'
  | 'PARTICIPANT_PERMISSION_UNSPECIFIED'

/**
 * A synchronizer the party's participant is connected to, envelope unwrapped.
 *
 * @category Types
 */
export interface ConnectedSynchronizer {
  synchronizerId: string
  synchronizerAlias: string
  permission: ParticipantPermission | undefined
}

/**
 * Whose synchronizers `connectedSynchronizers` reads: the connected party unless `party` says
 * otherwise. One party, since the ledger answers for one.
 *
 * @example
 * await connectedSynchronizers({ party: operator })
 *
 * @category Types
 */
export interface ConnectedSynchronizersParams {
  party?: string
}

type WireSynchronizer = {
  synchronizerId?: unknown
  synchronizerAlias?: unknown
  permission?: unknown
}

const PERMISSIONS = {
  PARTICIPANT_PERMISSION_SUBMISSION: true,
  PARTICIPANT_PERMISSION_CONFIRMATION: true,
  PARTICIPANT_PERMISSION_OBSERVATION: true,
  PARTICIPANT_PERMISSION_UNSPECIFIED: true,
} as const satisfies Record<ParticipantPermission, true>

const isPermission = (value: unknown): value is ParticipantPermission =>
  typeof value === 'string' && Object.hasOwn(PERMISSIONS, value)

export const connectedSynchronizersRequest = (party: string): LedgerApiParams => ({
  requestMethod: 'get',
  resource: '/v2/state/connected-synchronizers',
  query: { party },
})

const decodeSynchronizer = (wire: WireSynchronizer): ConnectedSynchronizer | undefined => {
  if (typeof wire.synchronizerId !== 'string' || typeof wire.synchronizerAlias !== 'string') {
    return undefined
  }
  return {
    synchronizerId: wire.synchronizerId,
    synchronizerAlias: wire.synchronizerAlias,
    permission: isPermission(wire.permission) ? wire.permission : undefined,
  }
}

export const decodeConnectedSynchronizers = (answer: unknown): ConnectedSynchronizer[] => {
  const synchronizers = (answer as { connectedSynchronizers?: unknown } | null)
    ?.connectedSynchronizers
  return Array.isArray(synchronizers)
    ? synchronizers.flatMap((wire: WireSynchronizer) => decodeSynchronizer(wire) ?? [])
    : []
}
