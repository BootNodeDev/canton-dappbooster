import { Tooltip, useTooltip } from '@ark-ui/react/tooltip'
import type { PointerEvent, ReactNode } from 'react'
import { cn } from '@/utils/cn'

const badgeClass =
  'relative size-4 rounded-full border border-border text-[0.6rem] font-bold text-fg-muted before:absolute before:left-1/2 before:top-1/2 before:size-6 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]'

const wordsClass = 'underline decoration-fg-soft decoration-dashed underline-offset-4'

export const InfoTip = ({
  label,
  children,
  className,
}: {
  children?: ReactNode
  className?: string
  label: string
}): React.JSX.Element => {
  const wordy = children === undefined || typeof children === 'string'
  const described = typeof children === 'string'
  const tooltip = useTooltip({
    'aria-label': described ? undefined : label,
    closeOnClick: false,
    positioning: { placement: 'top', strategy: 'fixed' },
  })
  const toggleOnTouch = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      tooltip.setOpen(!tooltip.open)
    }
  }

  return (
    <Tooltip.RootProvider value={tooltip}>
      {wordy ? (
        <Tooltip.Trigger
          aria-label={described ? undefined : label}
          className={cn(children === undefined ? badgeClass : wordsClass, className)}
          onPointerUp={toggleOnTouch}
          type="button"
        >
          {children ?? '?'}
        </Tooltip.Trigger>
      ) : (
        <Tooltip.Trigger asChild onPointerUp={toggleOnTouch}>
          <span className={cn('inline-flex', className)}>{children}</span>
        </Tooltip.Trigger>
      )}
      <Tooltip.Positioner asChild>
        <span>
          <Tooltip.Content asChild aria-hidden={described ? undefined : true}>
            <span className="z-30 block w-max max-w-56 rounded-lg border border-border bg-surface px-3 py-2 font-sans text-xs font-normal text-fg-muted shadow-[var(--shadow-card)] [-webkit-text-fill-color:currentColor]">
              {label}
            </span>
          </Tooltip.Content>
        </span>
      </Tooltip.Positioner>
    </Tooltip.RootProvider>
  )
}
