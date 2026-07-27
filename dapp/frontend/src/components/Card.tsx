import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// Surface card with the standard border + soft elevation.
export const Card = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div
    className={cn(
      'rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]',
      className,
    )}
    {...rest}
  />
)
