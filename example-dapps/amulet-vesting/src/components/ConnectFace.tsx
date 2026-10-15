import { useConnect } from '@bootnodedev/canton-connect'
import { CancelButton, ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { useEffect, useRef } from 'react'

export const ConnectFace = ({
  cancelClassName,
  className,
}: {
  cancelClassName?: string
  className?: string
}): React.JSX.Element => {
  const { isPending } = useConnect()
  const button = useRef<HTMLButtonElement>(null)
  const previous = useRef(isPending)

  // Only after a real swap: focusing on first paint would move focus nobody asked to move.
  useEffect(() => {
    const swapped = previous.current !== isPending
    previous.current = isPending

    if (swapped && document.activeElement === document.body) {
      button.current?.focus()
    }
  }, [isPending])

  return isPending ? (
    <CancelButton className={cancelClassName} ref={button} />
  ) : (
    <ConnectButton className={className} ref={button} />
  )
}
