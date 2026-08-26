import { useSelector } from '@xstate/react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectionStatus } from '#src/machine/connectionMachine'
import type { ConnectionStatus, Party } from '#src/types'

/**
 * Return shape of {@link useParty}. `party` follows the wallet's primary account, so it changes
 * under a live session when the user switches accounts.
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
 * Wagmi: `useAccount`, with `party.partyId` for `address`.
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
