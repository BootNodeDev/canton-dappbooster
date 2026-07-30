import { useCallback, useState } from 'react'
import { useConnectKitContext } from '../ConnectKitProvider'

export interface UseSignMessageResult {
  signMessage: (message: string) => Promise<string>
  signature: string | undefined
  isSigning: boolean
  error: Error | undefined
  reset: () => void
}

// The facade's signMessage owns message encoding; this hook only tracks call state.
export const useSignMessage = (): UseSignMessageResult => {
  const ctx = useConnectKitContext()
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
