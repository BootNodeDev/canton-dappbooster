import { useConnect } from '@bootnodedev/canton-connect'
import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { connectAnatomy } from '#src/components/WalletButton/anatomy'
import { composeAction } from '#src/components/WalletButton/composeAction'
import { cx } from '#src/utils/cx'

/**
 * Props for {@link ConnectButton}.
 *
 * @category Components
 */
export type ConnectButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Connect button. Can be customized.
 *
 * @example
 * import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
 *
 * <ConnectButton />
 * <ConnectButton>{label}</ConnectButton>
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/WalletButton/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @category Components
 */
export const ConnectButton = ({
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: ConnectButtonProps): ReactElement => {
  const { cancelConnect, connect, isPending } = useConnect()
  const handleClick = composeAction(onClick, isPending ? cancelConnect : connect)
  const ownLabel = isPending && children === undefined

  return (
    <button
      {...rest}
      aria-label={ownLabel ? 'Cancel connecting' : undefined}
      className={cx(connectAnatomy.parts.root, className)}
      onClick={handleClick}
      type={type}
      {...{ [connectAnatomy.states.pending]: isPending || undefined }}
    >
      {isPending && <span aria-hidden="true" className={connectAnatomy.parts.spinner} />}
      {children ?? (isPending ? 'Connecting…' : 'Connect wallet')}
    </button>
  )
}
