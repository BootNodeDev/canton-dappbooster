import { useSelector } from '@xstate/react'
import { useCallback, useState } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toConnectionStatus } from '#src/machine/connectionMachine'
import type { ConnectionStatus, ConnectionSubscription, WalletSdk } from '#src/types'

/** The resting state, hoisted so a hook that never called keeps one identity across renders. */
const IDLE = { isBusy: false, error: undefined } as const

/** In-flight and last-failure bookkeeping for one wallet call. */
type WalletCallState = { isBusy: boolean; error: Error | undefined }

// The one home of the two guard messages the SDK-calling hooks throw.
/** Throws when the wallet is disconnected or locked, the guard every SDK-calling hook shares. */
export const assertUsable = (status: ConnectionStatus, isLocked: boolean): void => {
  if (status !== 'connected') {
    throw new Error('wallet is not connected - call useConnect().connect() first')
  }

  if (isLocked) {
    throw new Error('wallet is locked - unlock it in the wallet')
  }
}

/**
 * Return shape of {@link useWalletCall}: busy/error state around one call, plus the session
 * pieces the public hooks assemble into their own results.
 */
export interface UseWalletCallResult {
  call: <T>(run: (sdk: WalletSdk) => Promise<T>) => Promise<T>
  isBusy: boolean
  error: Error | undefined
  reset: () => void
  connection: ConnectionSubscription
  sdk: WalletSdk
  status: ConnectionStatus
  isLocked: boolean
}

// The skeleton shared by the SDK-calling hooks: session selectors, the guards, and the
// busy/error bookkeeping around one call. Internal; the public hooks shape its pieces.
/**
 * Selects the session and wraps one SDK call with the connect/lock guard and busy/error
 * bookkeeping that `useExecute`, `useSignMessage` and `useLedger` share.
 */
export const useWalletCall = (): UseWalletCallResult => {
  const { connection } = useCantonConnectContext()

  const sdk = useSelector(connection, (snapshot) => snapshot.context.sdk)
  const status = useSelector(connection, toConnectionStatus)
  const isLocked = useSelector(connection, (snapshot) => snapshot.hasTag('unauthenticated'))

  const [state, setState] = useState<WalletCallState>(IDLE)

  const call = useCallback(
    async <T>(run: (walletSdk: WalletSdk) => Promise<T>): Promise<T> => {
      assertUsable(status, isLocked)

      setState({ isBusy: true, error: undefined })

      try {
        const result = await run(sdk)
        setState(IDLE)
        return result
      } catch (err) {
        const error = err as Error
        setState({ isBusy: false, error })
        throw error
      }
    },
    [isLocked, sdk, status],
  )

  const reset = useCallback((): void => setState(IDLE), [])

  return {
    call,
    isBusy: state.isBusy,
    error: state.error,
    reset,
    connection,
    sdk,
    status,
    isLocked,
  }
}
