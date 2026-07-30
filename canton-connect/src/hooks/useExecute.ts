import type { PrepareExecuteParams } from '@canton-network/dapp-sdk'
import { useCallback, useState } from 'react'
import { type TxStatusSnapshot, useConnectKitContext } from '../ConnectKitProvider'

export type { PrepareExecuteParams }

export interface UseExecuteResult {
  execute: (params: PrepareExecuteParams) => Promise<unknown>
  lastTx: TxStatusSnapshot | undefined
  isExecuting: boolean
  error: Error | undefined
  reset: () => void
}

// lastTx mirrors the live txChanged lifecycle (pending → signed → executed/failed); wired by ConnectKitProvider.
export const useExecute = (): UseExecuteResult => {
  const ctx = useConnectKitContext()
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
