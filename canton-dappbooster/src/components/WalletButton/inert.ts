import type { MouseEvent, MouseEventHandler } from 'react'

type InertProps = {
  'aria-disabled': true | undefined
  onClick: MouseEventHandler<HTMLButtonElement>
}

// Paired because `aria-disabled` keeps the button focusable but leaves the click live, so an inert
// button that kept its handler would still submit a caller's form.
export const resolveInert = (
  inert: boolean,
  armed: MouseEventHandler<HTMLButtonElement>,
): InertProps => ({
  'aria-disabled': inert || undefined,
  onClick: inert ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault() : armed,
})
