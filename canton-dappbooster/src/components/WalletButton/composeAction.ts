import type { MouseEvent, MouseEventHandler } from 'react'

// The consumer's handler runs first and `preventDefault` is how it opts out of the built-in action,
// so passing one never silently drops the behaviour the button exists for.
export const composeAction =
  (
    onClick: MouseEventHandler<HTMLButtonElement> | undefined,
    action: () => Promise<void>,
  ): MouseEventHandler<HTMLButtonElement> =>
  (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event)
    if (event.defaultPrevented) return

    void action().catch(() => undefined)
  }
