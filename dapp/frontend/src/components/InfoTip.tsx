import type { ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/utils/cn'

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
  const id = useId()
  // An element child must carry its own accessible name, because the trigger then stays out of the
  // tab order: a focusable one lands every amount in it, and a dialog would autofocus the first.
  const wordy = children === undefined || typeof children === 'string'

  return (
    <span className="group relative inline-flex">
      {wordy ? (
        <button
          type="button"
          aria-describedby={id}
          className={cn(
            children === undefined
              ? 'size-4 rounded-full border border-border text-[0.6rem] font-bold text-fg-muted'
              : 'cursor-help underline decoration-fg-soft decoration-dashed underline-offset-4',
            className,
          )}
        >
          {children ?? '?'}
        </button>
      ) : (
        <span className={cn('inline-flex cursor-help', className)}>{children}</span>
      )}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-56 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 font-sans text-xs font-normal text-fg-muted opacity-0 shadow-[var(--shadow-card)] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
        <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-surface" />
      </span>
    </span>
  )
}
