import { CompactAmount } from '@/components/CompactAmount'
import { cn } from '@/utils/cn'

export interface LegendItem {
  label: string
  swatch: string
  value: string
}

// Compact figure legend under a schedule bar. `swatch` is a Tailwind bg-* class
// or an arbitrary background value.
export const Legend = ({
  items,
  className,
}: {
  className?: string
  items: LegendItem[]
}): React.JSX.Element => (
  <div className={cn('flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-muted', className)}>
    {items.map((item) => (
      <span key={item.label} className="inline-flex items-center gap-1.5">
        <span className={cn('inline-block size-2.5 rounded-[3px]', item.swatch)} />
        {item.label}
        <span className="font-mono font-semibold text-fg">
          <CompactAmount value={item.value} />
        </span>
      </span>
    ))}
  </div>
)
