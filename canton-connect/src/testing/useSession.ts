import { useSelector } from '@xstate/react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { useConnect } from '#src/hooks/useConnect'
import { useParty } from '#src/hooks/useParty'
import { useWalletStatus } from '#src/hooks/useWalletStatus'
import type { ConnectionStatus, Party, WalletSdk } from '#src/types'

/** Every slice of the session in one object, which is what the suites assert against. */
type Session = {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  error: Error | undefined
  isLocked: boolean
  isPending: boolean
  party: Party | undefined
  reset: () => void
  sdk: WalletSdk
  status: ConnectionStatus
}

/**
 * Everything the reader hooks publish, in one object, so a provider test drives the real SDK and
 * asserts on the public surface. `sdk` rides along because no hook publishes it and a test watching
 * a stranded instance get replaced has nothing else to watch.
 *
 * @example
 * const { result } = renderHook(() => useSession(), { wrapper })
 * await waitFor(() => expect(result.current.status).toBe('connected'))
 */
export const useSession = (): Session => {
  const { connection } = useCantonConnectContext()

  const { connect, disconnect, error, isPending, reset } = useConnect()
  const { party, status } = useParty()
  const { isLocked } = useWalletStatus()

  const sdk = useSelector(connection, (snapshot) => snapshot.context.sdk)

  return { connect, disconnect, error, isLocked, isPending, party, reset, sdk, status }
}
