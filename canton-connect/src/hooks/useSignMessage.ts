import { useCallback, useState } from 'react'
import { useWalletCall } from '#src/hooks/useWalletCall'

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
  const { call, isBusy, error, reset: resetCall } = useWalletCall()

  const [signature, setSignature] = useState<string | undefined>(undefined)

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      setSignature(undefined)

      const result = await call((walletSdk) => walletSdk.signMessage({ message }))

      setSignature(result.signature)
      return result.signature
    },
    [call],
  )

  const reset = useCallback((): void => {
    setSignature(undefined)
    resetCall()
  }, [resetCall])

  return { signMessage, signature, isSigning: isBusy, error, reset }
}
