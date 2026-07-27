import { cn } from '@/lib/cn'
import { formatCC, formatDate } from '@/lib/format'
import type { VestingSchedule } from '@/lib/schedule'

interface MilestoneTimelineProps {
  schedule: VestingSchedule
  total: number
  nowMs: number
}

// Vertical list of milestone points with reached/pending state and the CC unlocked
// at each step (delta of cumulative fractions).
export const MilestoneTimeline = ({
  schedule,
  total,
  nowMs,
}: MilestoneTimelineProps): React.JSX.Element | null => {
  if (schedule.curve.kind !== 'milestone') {
    return null
  }
  const points = schedule.curve.points
  return (
    <ol className="flex flex-col gap-0">
      {points.map((point, i) => {
        const reached = new Date(point.time).getTime() <= nowMs
        const prevFraction = i === 0 ? 0 : points[i - 1].fraction
        const unlocked = (point.fraction - prevFraction) * total
        const isLast = i === points.length - 1
        return (
          <li key={point.time} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-1 size-3 rounded-full border-2',
                  reached
                    ? 'border-transparent bg-[image:var(--gradient-brand)]'
                    : 'border-border-strong bg-surface',
                )}
              />
              {!isLast && <span className="w-0.5 flex-1 bg-border" />}
            </div>
            <div className={cn('pb-5', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-fg">
                  {(point.fraction * 100).toFixed(0)}% vested
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide',
                    reached ? 'bg-success-soft text-success' : 'bg-muted text-fg-muted',
                  )}
                >
                  {reached ? 'Reached' : 'Pending'}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-xs text-fg-muted">
                {formatDate(point.time)} · +{formatCC(unlocked)} CC
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
