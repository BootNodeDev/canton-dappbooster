import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export const Card = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div
    className={cn(
      'rounded-[12px] border border-border bg-surface shadow-[var(--shadow-card)]',
      className,
    )}
    {...rest}
  />
)
