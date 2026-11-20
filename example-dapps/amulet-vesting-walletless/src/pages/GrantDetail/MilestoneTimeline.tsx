import { CompactAmount } from '@/components/CompactAmount'
import type { VestingSchedule } from '@/store/types'
import { multiplyByFraction } from '@/utils/amount'
import { cn } from '@/utils/cn'
import { formatDate, relativeTime } from '@/utils/format'
import { AMT } from '@/utils/tokens'

interface MilestoneTimelineProps {
  nowMs: number
  schedule: VestingSchedule
  total: string
}

export const MilestoneTimeline = ({
  schedule,
  total,
  nowMs,
}: MilestoneTimelineProps): React.JSX.Element | null => {
  if (schedule.curve.kind !== 'milestone') {
    return null
  }
  const points = schedule.curve.points
  const next = points.findIndex((point) => new Date(point.time).getTime() > nowMs)
  return (
    <ol className="relative flex flex-col gap-4 pl-6 before:absolute before:top-1.5 before:bottom-1.5 before:left-1.5 before:w-0.5 before:bg-border">
      {points.map((point, i) => {
        const reached = i < next || next === -1
        const unlocked = multiplyByFraction(
          total,
          point.fraction - (i === 0 ? 0 : points[i - 1].fraction),
        )
        return (
          <li key={point.time} className="relative flex justify-between gap-3 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1 -left-6 size-3.5 rounded-full border-2',
                reached
                  ? 'border-primary bg-primary shadow-[inset_0_0_0_2.5px_var(--surface)]'
                  : i === next
                    ? 'border-primary bg-surface'
                    : 'border-border-strong bg-surface',
              )}
            />
            <div>
              <div className="font-semibold text-fg">{formatDate(point.time)}</div>
              <div className="text-[0.8rem] text-fg-soft">
                {reached
                  ? 'Reached'
                  : i === next
                    ? `Next, ${relativeTime(point.time, nowMs)}`
                    : 'Upcoming'}
              </div>
            </div>
            <div className="text-right">
              <div className="font-num font-semibold text-fg tabular-nums">
                {(point.fraction * 100).toFixed(0)}% vested
              </div>
              <div className="font-num text-[0.8rem] text-fg-soft tabular-nums">
                +<CompactAmount value={unlocked} /> {AMT.symbol}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
