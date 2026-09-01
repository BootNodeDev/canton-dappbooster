import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useRef,
  useState,
} from 'react'

export interface UseDismissableResult<Root extends HTMLElement> {
  closers: {
    onBlur: (e: FocusEvent<HTMLElement>) => void
    onKeyDown: (e: KeyboardEvent) => void
  }
  keepFocus: (e: MouseEvent) => void
  open: boolean
  root: RefObject<Root | null>
  setOpen: (open: boolean) => void
  trigger: RefObject<HTMLButtonElement | null>
}

// Spread `closers` wherever focus can leave the control — the wrapper where a handler on it is
// legal, every button otherwise — and `keepFocus` on whatever the panel can be clicked on.
export const useDismissable = <Root extends HTMLElement>(): UseDismissableResult<Root> => {
  const [open, setOpen] = useState(false)
  const root = useRef<Root>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  return {
    closers: {
      onBlur: (e: FocusEvent<HTMLElement>) => {
        if (root.current?.contains(e.relatedTarget) !== true) {
          setOpen(false)
        }
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          // Closing unmounts whatever holds focus, which would otherwise drop it on the body.
          trigger.current?.focus()
          setOpen(false)
        }
      },
    },
    // Safari does not focus a button on mousedown, so without this the trigger blurs and the panel
    // unmounts before the click it was aimed at ever lands.
    keepFocus: (e: MouseEvent) => e.preventDefault(),
    open,
    root,
    setOpen,
    trigger,
  }
}
