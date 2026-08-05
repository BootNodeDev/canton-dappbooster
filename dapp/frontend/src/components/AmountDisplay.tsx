import { cn } from '@/lib/cn'
import { formatCC } from '@/lib/format'

interface AmountDisplayProps {
  value: number
  unit?: string
  className?: string
  gradient?: boolean
}

// Mono numeral + a muted unit suffix. The canonical way amounts appear.
export const AmountDisplay = ({
  value,
  unit = 'CC',
  className,
  gradient = false,
}: AmountDisplayProps): React.JSX.Element => (
  <span className={cn('font-mono tabular-nums', gradient && 'gradient-text', className)}>
    {formatCC(value)}
    {unit !== '' && <span className="ml-1 font-sans font-semibold text-fg-muted">{unit}</span>}
  </span>
)
