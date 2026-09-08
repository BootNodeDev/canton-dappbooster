import { useConnect } from '@bootnodedev/canton-connect'
import type { ComponentPropsWithRef, ReactElement } from 'react'
import { connectAnatomy } from '#src/components/WalletButton/anatomy'
import { composeAction } from '#src/components/WalletButton/composeAction'
import { resolveInert } from '#src/components/WalletButton/inert'
import { cx } from '#src/utils/cx'

/**
 * Props for {@link ConnectButton}.
 *
 * @category Components
 */
export type ConnectButtonProps = ComponentPropsWithRef<'button'>

/**
 * Connect button. Can be customized. Inert while an attempt is in flight, so a click only ever
 * connects; pair it with {@link CancelButton}, or take {@link WalletButton}, to let the user
 * abandon one.
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
  const { connect, isPending } = useConnect()

  return (
    <button
      {...rest}
      {...resolveInert(isPending, composeAction(onClick, connect))}
      className={cx(connectAnatomy.parts.root, className)}
      type={type}
      {...{ [connectAnatomy.states.pending]: isPending || undefined }}
    >
      {isPending && <span aria-hidden="true" className={connectAnatomy.parts.spinner} />}
      {children ?? (isPending ? 'Connecting…' : 'Connect wallet')}
    </button>
  )
}
