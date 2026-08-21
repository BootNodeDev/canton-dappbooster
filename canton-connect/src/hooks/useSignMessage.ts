import { useCallback, useState } from 'react'
import { useCantonConnectContext } from '#src/CantonConnectProvider'

/**
 * Return shape of {@link useSignMessage}. `signMessage` throws when nothing is connected, and
 * `reset` clears the last signature and error without touching the session.
 *
 * @category Hooks
 */
export interface UseSignMessageResult {
  signMessage: (message: string) => Promise<string>
  signature: string | undefined
  isSigning: boolean
  error: Error | undefined
  reset: () => void
}

/**
 * Signs an arbitrary message with the connected wallet; the SDK owns the encoding.
 * Wagmi: `useSignMessage`, same name and job.
 *
 * @throws with no {@link CantonConnectProvider} above it, and from `signMessage` where nothing is
 * connected or the wallet rejects, the rejection also landing in `error`.
 *
 * @example
 * const { signMessage } = useSignMessage()
 * const signed = await signMessage('Approve vesting claim')
 *
 * @category Hooks
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
