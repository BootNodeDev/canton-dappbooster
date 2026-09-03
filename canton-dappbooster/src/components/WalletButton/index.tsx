import { useWalletStatus } from '@bootnodedev/canton-connect'
import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { ConnectButton } from '#src/components/WalletButton/ConnectButton'
import { DisconnectButton } from '#src/components/WalletButton/DisconnectButton'

/**
 * Props for {@link WalletButton}.
 *
 * @category Components
 */
export type WalletButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Follows the session: {@link ConnectButton} without one, {@link DisconnectButton} with one.
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

  return isConnected ? <DisconnectButton {...props} /> : <ConnectButton {...props} />
}
