import { useConnect } from '@bootnodedev/canton-connect'
import type { ButtonHTMLAttributes, MouseEvent, ReactElement } from 'react'
import { anatomy } from '#src/components/ConnectButton/anatomy'
import { cx } from '#src/utils/cx'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** The face shown with no session: opens the wallet flow. */
export const Button = ({
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement => {
  const session = useConnect()
  const pending = session.isConnecting

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event)
    if (event.defaultPrevented) return

    void session.connect().catch(() => undefined)
  }

  return (
    <button
      {...rest}
      aria-disabled={pending || undefined}
      className={cx(anatomy.parts.root, className)}
      onClick={pending ? undefined : handleClick}
      type={type}
      {...{ [anatomy.states.mode]: 'connect', [anatomy.states.pending]: pending || undefined }}
    >
      {pending ? (
        <>
          <span aria-hidden="true" className={anatomy.parts.spinner} />
          Connecting…
        </>
      ) : (
        children
      )}
    </button>
  )
}
