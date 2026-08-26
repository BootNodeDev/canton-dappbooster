import { cn } from '@/utils/cn'

interface SelectProps<T extends string> {
  className?: string
  label: string
  onChange: (value: T) => void
  options: readonly { label: string; value: T }[]
  value: T
}

export const Select = <T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SelectProps<T>): React.JSX.Element => (
  <select
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value as T)}
    className={cn(
      'rounded-[8px] border border-border bg-surface py-1.5 pl-3 pr-9 text-xs font-semibold text-fg',
      className,
    )}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
)
