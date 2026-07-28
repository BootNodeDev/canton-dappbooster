import { useCallback, useState } from 'react'
import { useConnectKitContext } from '../ConnectKitProvider'

export interface UseSignMessageResult {
  signMessage: (message: string) => Promise<string>
  signature: string | undefined
  isSigning: boolean
  error: Error | undefined
  reset: () => void
}

// CIP-0103 signMessage exposed as a wagmi-style hook. DappClient does not
// expose signMessage as a typed method, so the call reaches through the
// underlying Provider via getProvider().request(...).
//
// The Promise resolves with the signature for imperative use; the same
// signature is also captured into hook state for declarative rendering.
export const useSignMessage = (): UseSignMessageResult => {
  const ctx = useConnectKitContext()
  const [signature, setSignature] = useState<string | undefined>(undefined)
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (ctx.client === undefined) {
        throw new Error('wallet is not connected — call useConnect().connect() first')
      }
      setIsSigning(true)
      setError(undefined)
      setSignature(undefined)
      try {
        const messageBase64 =
          typeof window === 'undefined'
            ? Buffer.from(message, 'utf8').toString('base64')
            : window.btoa(unescape(encodeURIComponent(message)))
        const result = (await ctx.client.getProvider().request({
          method: 'signMessage',
          params: { message: messageBase64 },
        })) as { signature: string }
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
    [ctx.client],
  )

  const reset = useCallback((): void => {
    setSignature(undefined)
    setError(undefined)
    setIsSigning(false)
  }, [])

  return { signMessage, signature, isSigning, error, reset }
}
