import type { ReactNode } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Card } from '@/components/Card'
import { cn } from '@/utils/cn'

interface GrantRowProps {
  action: ReactNode
  badges?: ReactNode
  className?: string
  detail?: ReactNode
  figure: { amount: string; dim?: boolean; label: string }
  heading?: 'h2' | 'h3'
  progress?: ReactNode
  title: ReactNode
}

export const GrantRow = ({
  action,
  badges,
  className,
  detail,
  figure,
  heading: Heading = 'h2',
  progress,
  title,
}: GrantRowProps): React.JSX.Element => (
  <Card
    className={cn(
      'grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-[1.125rem] [grid-template-areas:"head_head"_"progress_progress"_"figure_action"]',
      'md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(9.5rem,max-content)] md:gap-x-7 md:gap-y-2.5 md:px-6 md:py-5 md:[grid-template-areas:"head_progress_figure"_"head_progress_action"]',
      'xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.5fr)_minmax(9.5rem,0.7fr)_minmax(7rem,max-content)] xl:[grid-template-areas:"head_progress_figure_action"]',
      className,
    )}
  >
    <div className="min-w-0 self-center [grid-area:head]">
      <Heading className="truncate font-heading text-base font-bold text-fg">{title}</Heading>
      {badges !== undefined && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>
      )}
      {detail !== undefined && <div className="mt-2.5 text-xs text-fg-soft">{detail}</div>}
    </div>
    {progress !== undefined && (
      <div className="min-w-0 self-center [grid-area:progress]">{progress}</div>
    )}
    <div className="[grid-area:figure] md:self-end md:text-right xl:self-center">
      <div className="text-[0.8rem] font-semibold text-fg-muted">{figure.label}</div>
      <AmountDisplay
        value={figure.amount}
        markSize="small"
        className={cn(
          'mt-0.5 text-xl font-semibold tracking-tight',
          figure.dim ? 'text-fg-soft' : 'text-fg',
        )}
      />
    </div>
    <div className="flex items-end justify-end [grid-area:action] md:items-start xl:items-center">
      {action}
    </div>
  </Card>
)
