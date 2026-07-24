import { Copyable } from '@/components/ui/Copyable'
import { cn } from '@/utils/cn'

interface CopyableLabelProps {
  label: string
  value: string
  copyLabel?: string
  className?: string
}

// An uppercase section title with a copy control for the section's value (e.g. a JSON block).
export const CopyableLabel = ({
  label,
  value,
  copyLabel,
  className,
}: CopyableLabelProps): JSX.Element => (
  <div className={cn('flex items-center gap-1.5', className)}>
    <span className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</span>
    <Copyable
      value={value}
      label={copyLabel ?? label}
    />
  </div>
)
