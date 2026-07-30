import type { PrepareExecuteParams } from '@canton-network/dapp-sdk'
import { useCallback, useState } from 'react'
import { type TxStatusSnapshot, useCantonConnectContext } from '../CantonConnectProvider'

/**
 * The SDK's own params for `prepareExecuteAndWait`, re-exported so callers
 * don't need a direct dependency on `@canton-network/dapp-sdk` for the type.
 */
export type { PrepareExecuteParams }

/** Return value of `useExecute`. */
export interface UseExecuteResult {
  /**
   * Submits `params` through the connected wallet and resolves once the
   * ledger executes it. Throws if no wallet is connected.
   */
  execute: (params: PrepareExecuteParams) => Promise<unknown>
  lastTx: TxStatusSnapshot | undefined
  isExecuting: boolean
  error: Error | undefined
  reset: () => void
}

/**
 * Submits ledger commands through the connected wallet and tracks the
 * resulting transaction in `lastTx`, which `CantonConnectProvider` wires to the
 * SDK's `txChanged` event as it moves through pending, signed, and executed
 * or failed.
 *
 * Wagmi counterpart: `useWriteContract` and `useWaitForTransactionReceipt`
 * together, since `execute` resolves after execution rather than returning
 * at submission.
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
