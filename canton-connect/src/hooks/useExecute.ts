import type { PrepareExecuteParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import { useTxFeed } from '#src/hooks/useTxFeed'
import { useWalletCall } from '#src/hooks/useWalletCall'
import type { TxStatusSnapshot } from '#src/types'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { PrepareExecuteParams }

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
 * event.
 * Wagmi: `useWriteContract` + `useWaitForTransactionReceipt`, since `execute` resolves after
 * execution rather than at submission.
 *
 * @throws with no {@link CantonConnectProvider} above it, and from `execute` where nothing is
 * connected or the command fails, the failure also landing in `error`.
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
      call((walletSdk) => walletSdk.prepareExecuteAndWait(params)),
    [call],
  )

  return { execute, lastTx, isExecuting: isBusy, error, reset }
}
