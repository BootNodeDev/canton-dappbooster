import { useSelector } from '@xstate/react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { useAccount } from '#src/hooks/useAccount'
import { useConnect } from '#src/hooks/useConnect'
import { useDisconnect } from '#src/hooks/useDisconnect'
import { useWalletStatus } from '#src/hooks/useWalletStatus'
import type { Account, ConnectionStatus, DappSdkMethods } from '#src/types'

/** Every slice of the session in one object, which is what the suites assert against. */
type Session = {
  cancelConnect: () => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  error: Error | undefined
  isLocked: boolean
  isPending: boolean
  account: Account | undefined
  reset: () => void
  sdk: DappSdkMethods
  status: ConnectionStatus
}

/**
 * Everything the reader hooks publish, in one object, so a provider test drives the real SDK and
 * asserts on the public surface. `sdk` rides along because no hook publishes it and a test watching
 * an abandoned instance get replaced has nothing else to watch.
 *
 * @example
 * const { result } = renderHook(() => useSession(), { wrapper })
 * await waitFor(() => expect(result.current.status).toBe('connected'))
 */
export const useSession = (): Session => {
  const { connection } = useCantonConnectContext()

  const { cancelConnect, connect, error, isPending, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const { account, status } = useAccount()
  const { isLocked } = useWalletStatus()

  const sdk = useSelector(connection, (snapshot) => snapshot.context.sdk)

  return {
    cancelConnect,
    connect,
    disconnect,
    error,
    isLocked,
    isPending,
    account,
    reset,
    sdk,
    status,
  }
}
