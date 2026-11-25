import { CompactAmount } from '@/components/CompactAmount'
import { cn } from '@/utils/cn'

export interface LegendItem {
  label: string
  swatch: string
  value?: string
}

// A swatch per series, with its figure when one is given. `swatch` is a CSS background value.
export const Legend = ({
  items,
  className,
}: {
  className?: string
  items: LegendItem[]
}): React.JSX.Element => (
  <div className={cn('flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8rem] text-fg-muted', className)}>
    {items.map((item) => (
      <span key={item.label} className="inline-flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-[3px]" style={{ background: item.swatch }} />
        {item.label}
        {item.value !== undefined && (
          <span className="font-num font-semibold text-fg tabular-nums">
            <CompactAmount value={item.value} />
          </span>
        )}
      </span>
    ))}
  </div>
)
