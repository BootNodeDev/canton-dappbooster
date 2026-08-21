import type { PrepareExecuteParams } from '@canton-network/dapp-sdk'
import { useCallback, useState } from 'react'
import { type TxStatusSnapshot, useCantonConnectContext } from '#src/CantonConnectProvider'

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
 * event. Throws with no {@link CantonConnectProvider} above it.
 * Wagmi: `useWriteContract` + `useWaitForTransactionReceipt`, since `execute` resolves after
 * execution rather than at submission.
 *
 * @example
 * const { execute, lastTx } = useExecute()
 * await execute({ commandId: 'claim-1', commands })
 * lastTx?.status // 'pending' | 'signed' | 'executed' | 'failed'
 *
 * @category Hooks
 */
export const useExecute = (): UseExecuteResult => {
  const ctx = useCantonConnectContext()
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const execute = useCallback(
    async (params: PrepareExecuteParams): Promise<unknown> => {
      if (ctx.status !== 'connected') {
        throw new Error('wallet is not connected — call useConnect().connect() first')
      }

      setIsExecuting(true)
      setError(undefined)

      try {
        return await ctx.sdk.prepareExecuteAndWait(params)
      } catch (err) {
        const e = err as Error
        setError(e)
        throw e
      } finally {
        setIsExecuting(false)
      }
    },
    [ctx.sdk, ctx.status],
  )

  const reset = useCallback((): void => {
    setError(undefined)
    setIsExecuting(false)
  }, [])

  return { execute, lastTx: ctx.lastTx, isExecuting, error, reset }
}
