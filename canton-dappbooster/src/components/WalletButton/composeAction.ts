import type { MouseEvent, MouseEventHandler } from 'react'

// The consumer's handler runs first and `preventDefault` is how it opts out of the built-in action,
// so passing one never silently drops the behaviour the button exists for.
export const composeAction =
  (
    onClick: MouseEventHandler<HTMLButtonElement> | undefined,
    action: () => void | Promise<void>,
  ): MouseEventHandler<HTMLButtonElement> =>
  (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event)
    if (event.defaultPrevented) return

    // Wrapped because a cancel is synchronous, and `.catch` on its void return would throw.
    void Promise.resolve(action()).catch(() => undefined)
  }
