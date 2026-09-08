import { useConnect, useWalletStatus } from '@bootnodedev/canton-connect'
import { type ButtonHTMLAttributes, type ReactElement, useEffect, useRef } from 'react'
import { CancelButton } from '#src/components/WalletButton/CancelButton'
import { ConnectButton } from '#src/components/WalletButton/ConnectButton'
import { DisconnectButton } from '#src/components/WalletButton/DisconnectButton'

/**
 * Props for {@link WalletButton}. No `ref`: which element it lands on would depend on the session,
 * so reach for the face you want instead.
 *
 * @category Components
 */
export type WalletButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

type Face = 'cancel' | 'connect' | 'disconnect'

const faceFor = (isPending: boolean, isConnected: boolean): Face => {
  if (isPending) return 'cancel'
  if (isConnected) return 'disconnect'
  return 'connect'
}

/**
 * Follows the session, one button at a time: {@link CancelButton} while a connect is in flight,
 * {@link DisconnectButton} once a session stands, {@link ConnectButton} otherwise. Each face is
 * inert outside its own state, so whatever is on screen only ever does the thing it says.
 *
 * Swapping a face unmounts the focused button, so it hands focus to the one that took over.
 *
 * @example
 * import { WalletButton } from '@bootnodedev/canton-dappbooster/connect'
 *
 * <WalletButton />
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/WalletButton/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @category Components
 */
export const WalletButton = (props: WalletButtonProps): ReactElement => {
  const { isConnected } = useWalletStatus()
  const { isPending } = useConnect()
  const face = faceFor(isPending, isConnected)
  const button = useRef<HTMLButtonElement>(null)
  const previous = useRef(face)

  // Only after a real swap: focusing on first paint would move focus nobody asked to move.
  useEffect(() => {
    const swapped = previous.current !== face
    previous.current = face

    if (swapped && document.activeElement === document.body) {
      button.current?.focus()
    }
  }, [face])

  if (face === 'cancel') return <CancelButton {...props} ref={button} />
  if (face === 'disconnect') return <DisconnectButton {...props} ref={button} />
  return <ConnectButton {...props} ref={button} />
}
