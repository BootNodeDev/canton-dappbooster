import type { PrepareExecuteParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import type { CantonConnectProvider } from '#src/CantonConnectProvider'
import { useTxFeed } from '#src/hooks/useTxFeed'
import { useWalletCall } from '#src/hooks/useWalletCall'
import type { TxStatusSnapshot } from '#src/types'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { PrepareExecuteParams }

// An unset `actAs` lets the wallet pick its own primary, which may not be the party the kit shows.
/** Defaults `actAs` to the connected party, leaving a caller's own `actAs` untouched. */
const withActAs = (params: PrepareExecuteParams, partyId: string): PrepareExecuteParams =>
  params.actAs === undefined ? { ...params, actAs: [partyId] } : params

/**
 * Return shape of {@link useExecute}. `execute` resolves once the ledger has executed rather than
 * at submission, and throws when nothing is connected; `lastTx` follows the wallet's own
 * `txChanged` pushes, so it moves even while `execute` is still pending.
 *
 * @category Hooks
 */
export interface UseExecuteResult {
  execute: (params: PrepareExecuteParams) => Promise<unknown>
  lastTx: TxStatusSnapshot | undefined
  isExecuting: boolean
  error: Error | undefined
  reset: () => void
}

/**
 * Submits ledger commands and tracks the transaction in `lastTx`, fed by the SDK's `txChanged`
 * event. `actAs` defaults to the party `useParty` reports, so a submit acts as the party the UI
 * shows rather than the wallet's own primary.
 * Wagmi: `useWriteContract` + `useWaitForTransactionReceipt`, `execute` resolving after execution.
 *
 * @throws with no {@link CantonConnectProvider} above it, and from `execute` where nothing is
 * connected or no party is reported. A command that fails throws too, and lands in `error`.
 *
 * @example
 * const { execute, lastTx } = useExecute()
 * await execute({ commandId: 'claim-1', commands })
 * lastTx?.status // 'pending' | 'signed' | 'executed' | 'failed'
 *
 * @category Hooks
 */
export const useExecute = (): UseExecuteResult => {
  const { call, isBusy, error, reset, connection, sdk } = useWalletCall()

  const lastTx = useTxFeed(sdk, connection)

  const execute = useCallback(
    (params: PrepareExecuteParams): Promise<unknown> =>
      call((walletSdk, actingPartyId) =>
        walletSdk.prepareExecuteAndWait(withActAs(params, actingPartyId)),
      ),
    [call],
  )

  return { execute, lastTx, isExecuting: isBusy, error, reset }
}
