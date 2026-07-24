import { useState } from 'react'
import { PLAIN_ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { CHECK_ICON, COPY_ICON } from '@/components/ui/icons'
import { copyText } from '@/utils/clipboard'
import { cn } from '@/utils/cn'

interface CopyableProps {
  value: string
  label: string
  successMessage?: string
  testId?: string
  className?: string
}

const COPIED_RESET_MS = 1200

// Generic copy control: COPY_ICON swaps to CHECK_ICON briefly and copyText fires the toast.
export const Copyable = ({
  value,
  label,
  successMessage,
  testId,
  className,
}: CopyableProps): JSX.Element => {
  const [copied, setCopied] = useState(false)
  const onCopy = (): void => {
    copyText(value, successMessage ?? `${label} copied`, () => {
      setCopied(true)
      const handle = setTimeout(() => setCopied(false), COPIED_RESET_MS)
      ;(handle as unknown as { unref?: () => void }).unref?.()
    })
  }
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={`Copy ${label}`}
      onClick={onCopy}
      className={cn(PLAIN_ICON_BUTTON_CLASS, 'pointer-events-auto size-6 shrink-0', className)}
    >
      {copied ? CHECK_ICON : COPY_ICON}
    </button>
  )
}
