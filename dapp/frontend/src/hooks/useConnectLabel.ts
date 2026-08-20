import { useConnect } from '@bootnodedev/canton-connect'
import { useEffect, useState } from 'react'

// Nothing public reports the pick, so read the SDK picker's own message to the opener.
export const useConnectLabel = (): string => {
  const { isConnecting } = useConnect()
  const [picked, setPicked] = useState(false)

  useEffect(() => {
    if (!isConnecting) {
      setPicked(false)
      return
    }

    const onMessage = (event: MessageEvent): void => {
      // A real pick names its wallet, which tells it apart from a result posted to settle a connect.
      if (
        event.origin === window.location.origin &&
        event.data?.messageType === 'SPLICE_WALLET_PICKER_RESULT' &&
        typeof event.data.name === 'string'
      ) {
        setPicked(true)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isConnecting])

  if (!isConnecting) return 'Connect wallet'
  return picked ? 'Confirm in your wallet' : 'Connecting…'
}
