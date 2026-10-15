import { Select as ArkSelect, createListCollection } from '@ark-ui/react/select'
import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/utils/cn'
import { popoverClass, popoverItemClass } from '@/utils/popover'

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
}: SelectProps<T>): React.JSX.Element => {
  const collection = useMemo(() => createListCollection({ items: [...options] }), [options])

  return (
    <ArkSelect.Root
      className={className}
      collection={collection}
      onValueChange={(details) => onChange(details.value[0] as T)}
      positioning={{ sameWidth: true, strategy: 'fixed' }}
      value={[value]}
    >
      <ArkSelect.Label className="sr-only">{label}</ArkSelect.Label>
      <ArkSelect.Trigger className="inline-flex w-full items-center justify-between gap-2 rounded-[8px] border border-border bg-surface py-1.5 pl-3 pr-2.5 text-xs font-semibold text-fg focus-visible:outline-none focus-visible:shadow-[var(--ring)]">
        <ArkSelect.ValueText />
        <ChevronDown size={14} className="text-fg-muted" />
      </ArkSelect.Trigger>
      <ArkSelect.Positioner>
        <ArkSelect.Content className={cn(popoverClass, 'flex flex-col gap-0.5 rounded-lg p-1')}>
          {options.map((option) => (
            <ArkSelect.Item
              className={cn(popoverItemClass, 'text-xs')}
              item={option}
              key={option.value}
            >
              <ArkSelect.ItemText>{option.label}</ArkSelect.ItemText>
            </ArkSelect.Item>
          ))}
        </ArkSelect.Content>
      </ArkSelect.Positioner>
    </ArkSelect.Root>
  )
}
