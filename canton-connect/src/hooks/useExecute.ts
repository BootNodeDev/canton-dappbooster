import { useCallback, useState } from 'react'
import { type TxStatusSnapshot, useConnectKitContext } from '../ConnectKitProvider'

export interface ExecuteParams {
  commandId?: string
  commands: unknown[]
  actAs?: string[]
  readAs?: string[]
  disclosedContracts?: unknown[]
  synchronizerId?: string
  packageIdSelectionPreference?: string[]
}

export interface UseExecuteResult {
  execute: (params: ExecuteParams) => Promise<unknown>
  lastTx: TxStatusSnapshot | undefined
  isExecuting: boolean
  error: Error | undefined
  reset: () => void
}

// Wraps prepareExecuteAndWait and surfaces the live txChanged lifecycle
// (pending → signed → executed / failed) via the lastTx field. The
// txChanged events are wired by ConnectKitProvider; this hook just exposes
// the latest snapshot for declarative rendering.
export const useExecute = (): UseExecuteResult => {
  const ctx = useConnectKitContext()
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const execute = useCallback(
    async (params: ExecuteParams): Promise<unknown> => {
      if (ctx.client === undefined) {
        throw new Error('wallet is not connected — call useConnect().connect() first')
      }
      setIsExecuting(true)
      setError(undefined)
      try {
        return await ctx.client.prepareExecuteAndWait(
          params as Parameters<typeof ctx.client.prepareExecuteAndWait>[0],
        )
      } catch (err) {
        const e = err as Error
        setError(e)
        throw e
      } finally {
        setIsExecuting(false)
      }
    },
    [ctx.client],
  )

  const reset = useCallback((): void => {
    setError(undefined)
    setIsExecuting(false)
  }, [])

  return { execute, lastTx: ctx.lastTx, isExecuting, error, reset }
}
