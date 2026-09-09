import { type CopyOutcome, useCopyToClipboard } from '@bootnodedev/canton-dappbooster'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/utils/cn'

interface CopyButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  label: string
  onOutcome?: (outcome: CopyOutcome) => void
  size?: number
  value: string
}

export const CopyButton = ({
  className,
  label,
  onClick,
  onOutcome,
  size = 16,
  value,
  ...rest
}: CopyButtonProps): React.JSX.Element => {
  const { copy, state } = useCopyToClipboard()
  const copied = state === 'copied'
  return (
    <button
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      className={cn('transition-colors hover:text-fg', className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          void copy(value).then(onOutcome)
        }
      }}
      type="button"
      {...rest}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}
