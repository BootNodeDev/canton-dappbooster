import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { INFO_ICON } from '@/components/ui/icons'

type TooltipProps = {
  content: ReactNode
  label?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export const Tooltip = ({
  content,
  label = 'More information',
  side,
}: TooltipProps): JSX.Element => (
  <RadixTooltip.Root delayDuration={150}>
    <RadixTooltip.Trigger asChild>
      <button
        type="button"
        aria-label={label}
        className="inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus:outline-none focus-visible:text-foreground focus-visible:shadow-focus transition-colors"
      >
        {INFO_ICON}
      </button>
    </RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        {...(side !== undefined ? { side } : {})}
        sideOffset={3}
        collisionPadding={8}
        className="z-50 max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-border bg-surface px-3 py-2 text-[0.78rem] leading-snug text-foreground shadow-[var(--shadow-popover)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        {content}
        <RadixTooltip.Arrow className="fill-surface" />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
)

export const TooltipProvider = RadixTooltip.Provider
