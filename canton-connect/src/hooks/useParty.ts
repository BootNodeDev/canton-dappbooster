import { useConnectKitContext } from '../ConnectKitProvider'
import type { ConnectionStatus, Party } from '../types'

export interface UsePartyResult {
  party: Party | undefined
  status: ConnectionStatus
  isConnected: boolean
}

export const useParty = (): UsePartyResult => {
  const ctx = useConnectKitContext()
  return {
    party: ctx.party,
    status: ctx.status,
    isConnected: ctx.status === 'connected',
  }
}
