import { useCallback, useState } from 'react'
import { useCantonConnectContext } from '../CantonConnectProvider'

/** Return value of `useSignMessage`. */
export interface UseSignMessageResult {
  /**
   * Signs `message` with the connected wallet's key and resolves with the
   * signature. Throws if no wallet is connected.
   */
  signMessage: (message: string) => Promise<string>
  signature: string | undefined
  isSigning: boolean
  error: Error | undefined
  reset: () => void
}

/**
 * Signs an arbitrary message with the connected wallet — the SDK owns
 * message encoding — and tracks the result.
 *
 * Wagmi counterpart: `useSignMessage` — same name, same job.
 */
export const useSignMessage = (): UseSignMessageResult => {
  const ctx = useCantonConnectContext()
  const [signature, setSignature] = useState<string | undefined>(undefined)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (ctx.status !== 'connected') {
        throw new Error('wallet is not connected — call useConnect().connect() first')
      }
      setIsSigning(true)
      setError(undefined)
      setSignature(undefined)
      try {
        const result = await ctx.sdk.signMessage({ message })
        setSignature(result.signature)
        return result.signature
      } catch (err) {
        const e = err as Error
        setError(e)
        throw e
      } finally {
        setIsSigning(false)
      }
    },
    [ctx.sdk, ctx.status],
  )

  const reset = useCallback((): void => {
    setSignature(undefined)
    setError(undefined)
    setIsSigning(false)
  }, [])

  return { signMessage, signature, isSigning, error, reset }
}
