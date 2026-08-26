import { cn } from '@/utils/cn'
import { formatCC } from '@/utils/format'

interface AmountDisplayProps {
  className?: string
  gradient?: boolean
  unit?: string
  value: string
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
