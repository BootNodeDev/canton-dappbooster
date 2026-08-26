import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'linear' | 'milestone' | 'neutral' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  linear: 'text-accent-strong bg-accent/12 border-accent/30',
  milestone: 'text-warning bg-warning-soft border-warning/40',
  neutral: 'text-fg-muted bg-muted border-border',
  success: 'text-success bg-success-soft border-success/30',
  warning: 'text-warning bg-warning-soft border-warning/40',
  danger: 'text-danger bg-danger-soft border-danger/30',
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
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.04em]',
      tones[tone],
      className,
    )}
  >
    {children}
  </span>
)
