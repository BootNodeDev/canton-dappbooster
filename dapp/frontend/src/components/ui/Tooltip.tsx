import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { JSX, ReactNode } from 'react'
import { INFO_ICON } from '@/components/ui/icons'

type TooltipProps = {
  content: ReactNode
  label?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export const Tooltip = ({
  content,
  label = 'More information',
  side = 'bottom',
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
        side={side}
        sideOffset={3}
        collisionPadding={8}
        className="z-50 w-72 rounded-md border border-border bg-surface px-3 py-2 text-[0.78rem] leading-snug text-foreground shadow-[var(--shadow-popover)] data-[state=open]:animate-zoom-in-and-fade"
      >
        {content}
        <RadixTooltip.Arrow className="fill-surface" />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
)

export const TooltipProvider = RadixTooltip.Provider
