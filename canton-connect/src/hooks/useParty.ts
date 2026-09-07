import { useSelector } from '@xstate/react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectionStatus } from '#src/machine/connectionMachine'
import type { ConnectionStatus, Party } from '#src/types'

/**
 * Return shape of {@link useParty}. `party` is the primary among the accounts that can act on the
 * ledger, so it need not be the one the wallet flags primary, and it changes under a live session.
 *
 * @category Hooks
 */
export interface UsePartyResult {
  party: Party | undefined
  status: ConnectionStatus
  isConnected: boolean
}

/**
 * The connected account and status. `party` is `undefined` until a connect succeeds, and again
 * whenever a restored session is locked.
 *
 * @throws with no {@link CantonConnectProvider} above it.
 *
 * @example
 * const { party, isConnected } = useParty()
 * isConnected && <span>{party?.partyId}</span>
 *
 * @category Hooks
 */
export const useParty = (): UsePartyResult => {
  const { connection } = useCantonConnectContext()

  const party = useSelector(connection, (snapshot) => snapshot.context.party)
  const status = useSelector(connection, toConnectionStatus)

  return {
    party,
    status,
    isConnected: status === 'connected',
  }
}
