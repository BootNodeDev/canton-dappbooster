import type { PrepareExecuteParams } from '@canton-network/dapp-sdk'
import { useCallback, useState } from 'react'
import { type TxStatusSnapshot, useCantonConnectContext } from '#src/CantonConnectProvider'

/** Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type. */
export type { PrepareExecuteParams }

export interface UseExecuteResult {
  /** Resolves once the ledger has executed, not at submission. Throws if not connected. */
  execute: (params: PrepareExecuteParams) => Promise<unknown>
  lastTx: TxStatusSnapshot | undefined
  isExecuting: boolean
  error: Error | undefined
  reset: () => void
}

/**
 * Submits ledger commands and tracks the transaction in `lastTx`, fed by the SDK's
 * `txChanged` event. Wagmi: `useWriteContract` + `useWaitForTransactionReceipt`,
 * since `execute` resolves after execution rather than at submission.
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
