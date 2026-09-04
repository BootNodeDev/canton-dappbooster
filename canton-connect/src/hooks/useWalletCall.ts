import { useSelector } from '@xstate/react'
import { useCallback, useState } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toError } from '#src/connectError'
import { toConnectionStatus } from '#src/machine/connectionMachine'
import type { ConnectionStatus, ConnectionSubscription, WalletSdk } from '#src/types'

/** The resting state, hoisted so a hook that never called keeps one identity across renders. */
const IDLE = { isPending: false, error: undefined } as const

/** In-flight and last-failure bookkeeping for one wallet call. */
type WalletCallState = { isPending: boolean; error: Error | undefined }

/** What a caller hands `call`: the SDK client, and the id of the party the call acts as. */
type WalletCallRun<T> = (sdk: WalletSdk, partyId: string) => Promise<T>

/** Throws when the wallet is disconnected or locked, the guard every SDK-calling hook shares. */
export const assertUsable = (status: ConnectionStatus, isLocked: boolean): void => {
  if (status !== 'connected') {
    throw new Error('wallet is not connected - call useConnect().connect() first')
  }

  if (isLocked) {
    throw new Error('wallet is locked - unlock it in the wallet')
  }
}

/** Throws when the session reports no party, which a connected one can. */
function assertPartyId(partyId: string | undefined): asserts partyId is string {
  if (partyId === undefined) {
    throw new Error('wallet reports no usable party - allocate one in the wallet')
  }
}

/**
 * Return shape of {@link useWalletCall}: pending/error state around one call, plus the session
 * pieces the public hooks assemble into their own results.
 */
export interface UseWalletCallResult {
  call: <T>(run: WalletCallRun<T>) => Promise<T>
  isPending: boolean
  error: Error | undefined
  reset: () => void
  connection: ConnectionSubscription
  sdk: WalletSdk
  status: ConnectionStatus
  isLocked: boolean
}

// The skeleton shared by the SDK-calling hooks: session selectors, the guards, and the
// pending/error bookkeeping around one call. Internal; the public hooks shape its pieces.
/**
 * Selects the session and wraps one SDK call with the connect, lock and party guards plus the
 * pending/error bookkeeping `useExecute` and `useSignMessage` share.
 */
export const useWalletCall = (): UseWalletCallResult => {
  const { connection } = useCantonConnectContext()

  const sdk = useSelector(connection, (snapshot) => snapshot.context.sdk)
  const partyId = useSelector(connection, (snapshot) => snapshot.context.party?.partyId)
  const status = useSelector(connection, toConnectionStatus)
  const isLocked = useSelector(connection, (snapshot) => snapshot.hasTag('unauthenticated'))

  const [state, setState] = useState<WalletCallState>(IDLE)

  const call = useCallback(
    async <T>(run: WalletCallRun<T>): Promise<T> => {
      assertUsable(status, isLocked)
      assertPartyId(partyId)

      setState({ isPending: true, error: undefined })

      try {
        const result = await run(sdk, partyId)
        setState(IDLE)
        return result
      } catch (err) {
        const error = toError(err)
        setState({ isPending: false, error })
        throw error
      }
    },
    [isLocked, partyId, sdk, status],
  )

  const reset = useCallback((): void => setState(IDLE), [])

  return {
    call,
    isPending: state.isPending,
    error: state.error,
    reset,
    connection,
    sdk,
    status,
    isLocked,
  }
}
