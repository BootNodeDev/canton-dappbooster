import { useDisconnect } from '@bootnodedev/canton-connect'
import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { disconnectAnatomy } from '#src/components/WalletButton/anatomy'
import { composeAction } from '#src/components/WalletButton/composeAction'
import { cx } from '#src/utils/cx'

/**
 * Props for {@link DisconnectButton}.
 *
 * @category Components
 */
export type DisconnectButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Disconnect button. Can be customized.
 *
 * @example
 * import { DisconnectButton } from '@bootnodedev/canton-dappbooster/connect'
 *
 * <DisconnectButton />
 *
 * @example
 * <DisconnectButton onClick={(event) => { event.preventDefault(); toggleMenu() }}>
 *   {label}
 * </DisconnectButton>
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/WalletButton/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @category Components
 */
export const DisconnectButton = ({
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: DisconnectButtonProps): ReactElement => {
  const { disconnect } = useDisconnect()
  const handleClick = composeAction(onClick, disconnect)

  return (
    <button
      {...rest}
      className={cx(disconnectAnatomy.parts.root, className)}
      onClick={handleClick}
      type={type}
    >
      {children ?? 'Disconnect'}
    </button>
  )
}
