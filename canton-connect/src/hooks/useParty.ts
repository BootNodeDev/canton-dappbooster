import { useCantonConnectContext } from '../CantonConnectProvider'
import type { ConnectedWallet, ConnectionStatus, Party } from '../types'

export interface UsePartyResult {
  party: Party | undefined
  status: ConnectionStatus
  isConnected: boolean
  /** The wallet this session belongs to; `undefined` in popup mode — the SDK never says which it picked. */
  wallet: ConnectedWallet | undefined
}

/**
 * The connected account and status; `party` is `undefined` until `connect()` succeeds.
 * Wagmi: `useAccount`, with `party.partyId` for `address` and `wallet` for `connector`.
 */
export const useParty = (): UsePartyResult => {
  const ctx = useCantonConnectContext()
  return {
    party: ctx.party,
    status: ctx.status,
    isConnected: ctx.status === 'connected',
    wallet: ctx.wallet,
  }
}
