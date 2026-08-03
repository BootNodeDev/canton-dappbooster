import { useCantonConnectContext } from '../CantonConnectProvider'
import type { ConnectionStatus, Party } from '../types'

export interface UsePartyResult {
  party: Party | undefined
  status: ConnectionStatus
  isConnected: boolean
}

/**
 * The connected account and status; `party` is `undefined` until `connect()` succeeds.
 * Wagmi: `useAccount`, with `party.partyId` for `address`.
 */
export const useParty = (): UsePartyResult => {
  const ctx = useCantonConnectContext()
  return {
    party: ctx.party,
    status: ctx.status,
    isConnected: ctx.status === 'connected',
  }
}
