import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type BadgeTone = 'warning' | 'success' | 'neutral'

const TONE_CLASS: Record<BadgeTone, string> = {
  warning: 'border-warning/40 bg-warning-soft text-warning',
  success: 'border-success/40 bg-success-soft text-success',
  neutral: 'border-border bg-muted text-muted-foreground',
}

// Compact status pill (Pending, Confirmed, Locked, ...). One shape so statuses stay uniform.
export const Badge = ({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}): JSX.Element => (
  <span
    className={cn(
      'shrink-0 rounded-[3px] border px-2 py-0.5 text-[0.66rem] font-semibold',
      TONE_CLASS[tone],
      className,
    )}
  >
    {children}
  </span>
)
