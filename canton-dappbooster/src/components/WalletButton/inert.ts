import type { MouseEvent, MouseEventHandler } from 'react'

type InertProps = {
  'aria-disabled': true | undefined
  onClick: MouseEventHandler<HTMLButtonElement>
}

/**
 * Resolves a button's inert state into the `aria-disabled` it carries and the click it takes.
 * Paired so neither can be written without the other: `aria-disabled` keeps the button focusable
 * and announced, unlike the native attribute, but leaves the click live, so an inert button that
 * kept its handler would still run a caller's `type="submit"`.
 *
 * @example
 * <button {...resolveInert(isPending, handleClick)} />
 */
export const resolveInert = (
  inert: boolean,
  armed: MouseEventHandler<HTMLButtonElement>,
): InertProps => ({
  'aria-disabled': inert || undefined,
  onClick: inert ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault() : armed,
})
