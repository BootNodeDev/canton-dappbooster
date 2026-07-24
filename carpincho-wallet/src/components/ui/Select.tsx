import * as RadixSelect from '@radix-ui/react-select'
import { CHECK_ICON, CHEVRON_DOWN_ICON } from '@/components/ui/icons'
import { cn } from '@/utils/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  ariaLabel: string
  id?: string
  testId?: string
}

const TRIGGER_CLASS =
  'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-base leading-[1.5] ' +
  'text-foreground bg-surface border border-border-strong rounded-md transition-colors ' +
  'focus:border-primary focus:outline-0 focus:shadow-focus data-[placeholder]:text-form-placeholder'

const CONTENT_CLASS =
  'z-50 overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-popover)] ' +
  'animate-in fade-in-0 zoom-in-95'

const ITEM_CLASS =
  'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-base text-foreground outline-none ' +
  'data-[highlighted]:bg-primary-soft data-[state=checked]:font-semibold'

export const Select = ({
  value,
  onValueChange,
  options,
  ariaLabel,
  id,
  testId,
}: SelectProps): JSX.Element => (
  <RadixSelect.Root
    value={value}
    onValueChange={onValueChange}
  >
    <RadixSelect.Trigger
      id={id}
      data-testid={testId}
      aria-label={ariaLabel}
      className={TRIGGER_CLASS}
    >
      <RadixSelect.Value />
      <RadixSelect.Icon className="text-muted-foreground">{CHEVRON_DOWN_ICON}</RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content
        position="popper"
        sideOffset={4}
        className={cn(CONTENT_CLASS, 'w-[var(--radix-select-trigger-width)]')}
      >
        <RadixSelect.Viewport>
          {options.map((option) => (
            <RadixSelect.Item
              key={option.value}
              value={option.value}
              className={ITEM_CLASS}
            >
              <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              <RadixSelect.ItemIndicator className="text-primary">
                {CHECK_ICON}
              </RadixSelect.ItemIndicator>
            </RadixSelect.Item>
          ))}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>
)
