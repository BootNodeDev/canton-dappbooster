import { useSelector } from '@xstate/react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectionStatus } from '#src/machine/connectionMachine'
import type { Account, ConnectionStatus } from '#src/types'

/**
 * Return shape of {@link useAccount}. `account` is the one the wallet flags primary, never
 * substituted, so ask {@link isUsableAccount} before acting as it; it changes under a live session.
 *
 * @category Hooks
 */
export interface UseAccountResult {
  account: Account | undefined
  status: ConnectionStatus
  isConnected: boolean
}

/**
 * The connected account and status, as the wallet reports it. `account` is `undefined` until a
 * connect succeeds, and again whenever a restored session is locked.
 *
 * @throws with no {@link CantonConnectProvider} above it.
 *
 * @example
 * const { account, isConnected } = useAccount()
 * isConnected && <span>{account?.hint}</span>
 *
 * @category Hooks
 */
export const useAccount = (): UseAccountResult => {
  const { connection } = useCantonConnectContext()

  const account = useSelector(connection, (snapshot) => snapshot.context.account)
  const status = useSelector(connection, toConnectionStatus)

  return {
    account,
    status,
    isConnected: status === 'connected',
  }
}
