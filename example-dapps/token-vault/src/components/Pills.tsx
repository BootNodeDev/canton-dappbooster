import { ToggleGroup } from '@ark-ui/react/toggle-group'
import { cn } from '@/utils/cn'

type Variant = 'outline' | 'segmented'

interface PillsProps<T extends string> {
  className?: string
  label: string
  onChange: (value: T) => void
  options: readonly { count?: number; label: string; value: T }[]
  value: T
  variant?: Variant
}

const rootClass: Record<Variant, string> = {
  outline: 'flex flex-wrap items-center gap-1.5',
  segmented: 'inline-flex gap-0.5 rounded-control border border-border bg-surface-2 p-[3px]',
}

const itemClass: Record<Variant, string> = {
  outline:
    'inline-flex h-[2.125rem] shrink-0 items-center gap-1.5 rounded-chip border border-transparent px-3 text-sm font-semibold text-fg-muted transition-colors hover:text-fg data-[state=on]:border-[var(--filter-on-border)] data-[state=on]:bg-[var(--filter-on-bg)] data-[state=on]:text-[var(--filter-on-fg)]',
  segmented:
    'h-9 flex-1 whitespace-nowrap rounded-[calc(var(--radius-control)-3px)] px-3.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/0.12)]',
}

export const Pills = <T extends string>({
  className,
  label,
  onChange,
  options,
  value,
  variant = 'outline',
}: PillsProps<T>): React.JSX.Element => (
  <ToggleGroup.Root
    aria-label={label}
    className={cn(rootClass[variant], className)}
    deselectable={false}
    onValueChange={(details) => onChange(details.value[0] as T)}
    value={[value]}
  >
    {options.map((option) => (
      <ToggleGroup.Item className={itemClass[variant]} key={option.value} value={option.value}>
        {option.label}
        {option.count !== undefined && (
          <span className="text-xs font-semibold tabular-nums opacity-70">{option.count}</span>
        )}
      </ToggleGroup.Item>
    ))}
  </ToggleGroup.Root>
)
