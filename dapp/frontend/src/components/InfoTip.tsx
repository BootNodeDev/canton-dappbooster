import { Tooltip, useTooltip } from '@ark-ui/react/tooltip'
import type { PointerEvent, ReactNode } from 'react'
import { cn } from '@/utils/cn'

// The badge reads at 16px but has to be pressable at 24, hence the wider pseudo.
const badgeClass =
  'relative size-4 rounded-full border border-border text-[0.6rem] font-bold text-fg-muted before:absolute before:left-1/2 before:top-1/2 before:size-6 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]'

const wordsClass = 'underline decoration-fg-soft decoration-dashed underline-offset-4'

// Wraps the words the tooltip explains, dash-underlined; with no children it is a `?` badge for
// where there is no phrase to underline. Described-by rather than labelled, so the trigger keeps
// its own reading and the note comes after it.
export const InfoTip = ({
  label,
  children,
  className,
}: {
  children?: ReactNode
  className?: string
  label: string
}): React.JSX.Element => {
  // An element child must carry its own accessible name, because the trigger then stays out of the
  // tab order: a focusable one lands every amount in it, and a dialog would autofocus the first.
  const wordy = children === undefined || typeof children === 'string'
  // Only a worded trigger can point at the bubble: a badge has no reading to describe and takes the
  // note as its own name, and an element child carries no describedby at all.
  const described = typeof children === 'string'
  const tooltip = useTooltip({
    // What drops `role="tooltip"` and the id off the bubble, so nothing points at it.
    'aria-label': described ? undefined : label,
    // Off, or the tap that opens the bubble closes it again on the click that follows.
    closeOnClick: false,
    // Fixed, because the bubble is not portalled and several of its call sites sit inside a
    // scrolling card or an open dialog.
    positioning: { placement: 'top', strategy: 'fixed' },
  })
  // Zag ignores touch pointers on purpose, which on a phone leaves the note unreachable.
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
          // Zag's tooltip trigger is the one in the set that leaves `type` off, and the default is
          // submit. Every figure in the app renders one of these.
          type="button"
        >
          {children ?? '?'}
        </Tooltip.Trigger>
      ) : (
        <Tooltip.Trigger asChild onPointerUp={toggleOnTouch}>
          <span className={cn('inline-flex', className)}>{children}</span>
        </Tooltip.Trigger>
      )}
      {/* Spans, not Ark's default divs: most call sites sit inside a paragraph or a figure, and a
          div there is invalid nesting the browser recovers from by moving the element. */}
      <Tooltip.Positioner asChild>
        <span>
          {/* text-fill-color is inherited and beats `color`, so inside `.gradient-text` (the hero
              KPI) the bubble would render its label invisible. */}
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
