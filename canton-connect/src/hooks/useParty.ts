import { useCantonConnectContext } from '../CantonConnectProvider'
import type { ConnectionStatus, Party } from '../types'

/** Return value of `useParty`. */
export interface UsePartyResult {
  party: Party | undefined
  status: ConnectionStatus
  isConnected: boolean
}

/**
 * The connected account and connection status — `party` is `undefined` and
 * `status` is `'idle'` before `connect()` succeeds.
 *
 * Wagmi counterpart: `useAccount`, with `party.partyId` as the analogue of `address`.
 */
export const useParty = (): UsePartyResult => {
  const ctx = useCantonConnectContext()
  return {
    party: ctx.party,
    status: ctx.status,
    isConnected: ctx.status === 'connected',
  }
}
