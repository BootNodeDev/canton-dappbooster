import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

// Shared eyebrow heading for list sections (Holdings, Faucet, date groups, ...) so every
// section title shares one size, colour, and weight. Separation to the content below comes
// from the parent's `gap`, keeping the bottom spacing uniform across sections.
export const SECTION_LABEL_CLASS =
  'px-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

export const SectionLabel = ({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}): JSX.Element => <div className={cn(SECTION_LABEL_CLASS, className)}>{children}</div>
