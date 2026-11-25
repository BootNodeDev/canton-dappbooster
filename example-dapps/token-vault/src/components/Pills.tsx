import { ToggleGroup } from '@ark-ui/react/toggle-group'
import { cn } from '@/utils/cn'

interface PillsProps<T extends string> {
  className?: string
  disabled?: boolean
  label: string
  onChange: (value: T) => void
  options: readonly { label: string; value: T }[]
  value: T
  variant?: 'segmented'
}

// Segmented only: no list here to filter, so the vesting apps' outline look was left out.
export const Pills = <T extends string>({
  className,
  disabled,
  label,
  onChange,
  options,
  value,
}: PillsProps<T>): React.JSX.Element => (
  <ToggleGroup.Root
    aria-label={label}
    className={cn(
      'inline-flex gap-0.5 rounded-control border border-border bg-surface-2 p-[3px]',
      className,
    )}
    deselectable={false}
    disabled={disabled}
    onValueChange={(details) => onChange(details.value[0] as T)}
    value={[value]}
  >
    {options.map((option) => (
      <ToggleGroup.Item
        className="h-9 flex-1 whitespace-nowrap rounded-[calc(var(--radius-control)-3px)] px-3.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-45 data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
        key={option.value}
        value={option.value}
      >
        {option.label}
      </ToggleGroup.Item>
    ))}
  </ToggleGroup.Root>
)
