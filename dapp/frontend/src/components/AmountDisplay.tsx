import { cn } from '@/lib/cn'
import { formatCC } from '@/lib/format'

interface AmountDisplayProps {
  value: number
  // Token unit, default CC.
  unit?: string
  className?: string
  unitClassName?: string
  // Render with the brand gradient text clip (hero figures).
  gradient?: boolean
}

// Mono numeral + a muted unit suffix. The canonical way amounts appear.
export const AmountDisplay = ({
  value,
  unit = 'CC',
  className,
  unitClassName,
  gradient = false,
}: AmountDisplayProps): React.JSX.Element => (
  <span className={cn('font-mono tabular-nums', gradient && 'gradient-text', className)}>
    {formatCC(value)}
    <span className={cn('ml-1 font-sans font-semibold text-fg-muted', unitClassName)}>{unit}</span>
  </span>
)
