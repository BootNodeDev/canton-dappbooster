import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'curve' | 'neutral' | 'success' | 'warning' | 'danger'

const dot = 'before:size-1.5 before:rounded-full before:bg-current before:content-[""]'

const tones: Record<Tone, string> = {
  curve: 'bg-primary-soft text-primary-strong',
  neutral: 'bg-muted text-fg-muted',
  success: cn('bg-success-soft text-success', dot),
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

interface StatusPillProps {
  children: ReactNode
  className?: string
  tone?: Tone
}

export const StatusPill = ({
  tone = 'neutral',
  children,
  className,
}: StatusPillProps): React.JSX.Element => (
  <span
    className={cn(
      'inline-flex h-[1.375rem] items-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 text-xs font-semibold',
      tones[tone],
      className,
    )}
  >
    {children}
  </span>
)
