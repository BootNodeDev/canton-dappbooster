import { ToggleGroup } from '@ark-ui/react/toggle-group'

type Variant = 'outline' | 'segmented'

interface PillsProps<T extends string> {
  label: string
  onChange: (value: T) => void
  options: readonly { label: string; value: T }[]
  value: T
  variant?: Variant
}

const rootClass: Record<Variant, string> = {
  outline: 'flex flex-wrap items-center gap-2',
  segmented: 'inline-flex rounded-lg border border-border bg-surface p-1',
}

const itemClass: Record<Variant, string> = {
  outline:
    'rounded-full border border-border px-3 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:text-fg data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-fg',
  segmented:
    'rounded-md px-3 py-1 text-xs font-bold text-fg-muted transition-colors hover:text-fg data-[state=on]:bg-primary-soft data-[state=on]:text-fg',
}

// One of a short, always-visible set. Ark reports the choice as a radio group, so the pressed pill
// is a checked radio rather than a class name, and the arrow keys move between them.
export const Pills = <T extends string>({
  label,
  onChange,
  options,
  value,
  variant = 'outline',
}: PillsProps<T>): React.JSX.Element => (
  <ToggleGroup.Root
    aria-label={label}
    className={rootClass[variant]}
    // The set always stands for something, so there is no "none of them" to fall back to.
    deselectable={false}
    onValueChange={(details) => onChange(details.value[0] as T)}
    value={[value]}
  >
    {options.map((option) => (
      <ToggleGroup.Item className={itemClass[variant]} key={option.value} value={option.value}>
        {option.label}
      </ToggleGroup.Item>
    ))}
  </ToggleGroup.Root>
)
