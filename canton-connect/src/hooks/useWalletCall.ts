import { useSelector } from '@xstate/react'
import { useCallback, useState } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { toError } from '#src/connectError'
import { toConnectionStatus } from '#src/machine/connectionMachine'
import type { ConnectionStatus, ConnectionSubscription, Party, WalletSdk } from '#src/types'

/** The resting state, hoisted so a hook that never called keeps one identity across renders. */
const IDLE = { isBusy: false, error: undefined } as const

/** In-flight and last-failure bookkeeping for one wallet call. */
type WalletCallState = { isBusy: boolean; error: Error | undefined }

/** What a caller hands `call`: the SDK client, and the party the call acts as. */
type WalletCallRun<T> = (sdk: WalletSdk, party: Party) => Promise<T>

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
function assertParty(party: Party | undefined): asserts party is Party {
  if (party === undefined) {
    throw new Error('wallet reports no usable party - allocate one in the wallet')
  }
}

/**
 * Return shape of {@link useWalletCall}: busy/error state around one call, plus the session
 * pieces the public hooks assemble into their own results.
 */
export interface UseWalletCallResult {
  call: <T>(run: WalletCallRun<T>) => Promise<T>
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
 * Selects the session and wraps one SDK call with the connect, lock and party guards plus the
 * busy/error bookkeeping `useExecute` and `useSignMessage` share.
 */
export const useWalletCall = (): UseWalletCallResult => {
  const { connection } = useCantonConnectContext()

  const sdk = useSelector(connection, (snapshot) => snapshot.context.sdk)
  const party = useSelector(connection, (snapshot) => snapshot.context.party)
  const status = useSelector(connection, toConnectionStatus)
  const isLocked = useSelector(connection, (snapshot) => snapshot.hasTag('unauthenticated'))

  const [state, setState] = useState<WalletCallState>(IDLE)

  const call = useCallback(
    async <T>(run: WalletCallRun<T>): Promise<T> => {
      assertUsable(status, isLocked)
      assertParty(party)

      setState({ isBusy: true, error: undefined })

      try {
        const result = await run(sdk, party)
        setState(IDLE)
        return result
      } catch (err) {
        const error = toError(err)
        setState({ isBusy: false, error })
        throw error
      }
    },
    [isLocked, party, sdk, status],
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
