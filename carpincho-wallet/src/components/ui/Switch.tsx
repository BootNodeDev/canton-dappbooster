import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/utils/cn'

// On/off pill toggle.
export const Switch = ({ className, ...props }: SwitchPrimitive.SwitchProps): JSX.Element => (
  <SwitchPrimitive.Root
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border bg-muted transition-[background-color,border-color,box-shadow] duration-200',
      'data-[state=checked]:border-transparent data-[state=checked]:bg-primary data-[state=checked]:shadow-[var(--shadow-toggle-on)]',
      'focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-[18px] translate-x-[3px] rounded-full bg-primary-foreground shadow-[0_1px_3px_rgba(0,0,0,0.45)] transition-transform duration-200 data-[state=checked]:translate-x-[23px]" />
  </SwitchPrimitive.Root>
)
