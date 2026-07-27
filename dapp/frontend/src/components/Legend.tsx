import { cn } from '@/lib/cn'
import { formatCC } from '@/lib/format'

export interface LegendItem {
  label: string
  value: number
  swatch: string
}

// Compact figure legend under a schedule bar. `swatch` is a Tailwind bg-* class
// or an arbitrary background value.
export const Legend = ({
  items,
  className,
}: {
  items: LegendItem[]
  className?: string
}): React.JSX.Element => (
  <div className={cn('flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-muted', className)}>
    {items.map((item) => (
      <span key={item.label} className="inline-flex items-center gap-1.5">
        <span className={cn('inline-block size-2.5 rounded-[3px]', item.swatch)} />
        {item.label}
        <span className="font-mono font-semibold text-fg">{formatCC(item.value)}</span>
      </span>
    ))}
  </div>
)
