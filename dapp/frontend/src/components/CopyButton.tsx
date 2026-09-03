import { type CopyOutcome, useCopyToClipboard } from '@bootnodedev/canton-dappbooster'
import { CheckIcon, CopyIcon } from '@/icons'
import { cn } from '@/utils/cn'

interface CopyButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  label: string
  onOutcome?: (outcome: CopyOutcome) => void
  size?: number
  value: string
}

// The icon swapping to a check is the whole success feedback, so a caller that has to speak on
// failure passes `onOutcome`: a rejected write leaves the icon unchanged and is otherwise silent.
// Not `onCopy`, which is the DOM clipboard event a button already carries.
export const CopyButton = ({
  className,
  label,
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
      onClick={() => void copy(value).then(onOutcome)}
      type="button"
      {...rest}
    >
      {copied ? <CheckIcon width={size} height={size} /> : <CopyIcon width={size} height={size} />}
    </button>
  )
}
