import { useConnect } from '@bootnodedev/canton-connect'
import { type ComponentPropsWithRef, type ReactElement, useEffect, useState } from 'react'
import { cancelAnatomy } from '#src/components/WalletButton/anatomy'
import { composeAction } from '#src/components/WalletButton/composeAction'
import { resolveInert } from '#src/components/WalletButton/inert'
import { cx } from '#src/utils/cx'
import { SR_ONLY } from '#src/utils/srOnly'

/**
 * Props for {@link CancelButton}.
 *
 * @category Components
 */
export type CancelButtonProps = ComponentPropsWithRef<'button'>

/**
 * Abandons the connect attempt {@link ConnectButton} started, and is inert while there is none.
 * Reach for it wherever a wallet prompt the user walked away from would otherwise leave the app
 * pending forever. It spins while the attempt is in flight and keeps its accessible name on the
 * action, so the wait is announced through the live region beside it rather than by renaming the
 * button.
 *
 * @example
 * import { CancelButton } from '@bootnodedev/canton-dappbooster/connect'
 *
 * <CancelButton />
 *
 * @example
 * <CancelButton>{label}</CancelButton>
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/WalletButton/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @category Components
 */
export const CancelButton = ({
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: CancelButtonProps): ReactElement => {
  const { cancelConnect, isPending } = useConnect()
  const [painted, setPainted] = useState(false)

  // A live region that arrives already filled is never read out, and a consumer swapping this
  // button in mounts it mid-attempt, so the text has to land a paint later.
  useEffect(() => setPainted(true), [])

  return (
    <>
      <button
        {...rest}
        {...resolveInert(!isPending, composeAction(onClick, cancelConnect))}
        className={cx(cancelAnatomy.parts.root, className)}
        type={type}
        {...{ [cancelAnatomy.states.pending]: isPending || undefined }}
      >
        {isPending && <span aria-hidden="true" className={cancelAnatomy.parts.spinner} />}
        {children ?? 'Cancel'}
      </button>
      {/* Outside the button so it cannot join its accessible name, which stays the action. */}
      <span className={cancelAnatomy.parts.status} role="status" style={SR_ONLY}>
        {painted && isPending ? 'Connecting…' : ''}
      </span>
    </>
  )
}
