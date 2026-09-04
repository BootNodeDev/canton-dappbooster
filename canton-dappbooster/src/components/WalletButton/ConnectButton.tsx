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
  const session = useConnect()
  const pending = session.isPending
  const handleClick = composeAction(onClick, session.connect)

  return (
    <button
      {...rest}
      aria-disabled={pending || undefined}
      className={cx(connectAnatomy.parts.root, className)}
      onClick={pending ? undefined : handleClick}
      type={type}
      {...{ [connectAnatomy.states.pending]: pending || undefined }}
    >
      {pending && <span aria-hidden="true" className={connectAnatomy.parts.spinner} />}
      {children ?? (pending ? 'Connecting…' : 'Connect wallet')}
    </button>
  )
}
