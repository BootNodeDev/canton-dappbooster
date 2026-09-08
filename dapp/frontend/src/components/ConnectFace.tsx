import { useConnect } from '@bootnodedev/canton-connect'
import { CancelButton, ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { useEffect, useRef } from 'react'

// A leaf on purpose: it is the only thing subscribed to the connect state, so a wallet change
// re-renders one button rather than the header or the whole empty state around it.
export const ConnectFace = ({
  cancelClassName,
  className,
}: {
  cancelClassName?: string
  className?: string
}): React.JSX.Element => {
  const { isPending } = useConnect()
  const box = useRef<HTMLSpanElement>(null)
  const previous = useRef(isPending)

  // The swap unmounts the focused button and focus falls to <body>, so the keyboard loses its
  // place. Hand it to whichever button took over, and only then: a focus move nobody asked for on
  // first paint would be worse than the problem.
  useEffect(() => {
    const swapped = previous.current !== isPending
    previous.current = isPending

    if (swapped && document.activeElement === document.body) {
      box.current?.querySelector('button')?.focus()
    }
  }, [isPending])

  return (
    <span className="inline-flex" ref={box}>
      {isPending ? (
        <CancelButton className={cancelClassName} />
      ) : (
        <ConnectButton className={className} />
      )}
    </span>
  )
}
