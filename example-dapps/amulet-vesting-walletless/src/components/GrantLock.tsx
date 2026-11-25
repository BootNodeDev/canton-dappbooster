import { Lock } from 'lucide-react'
import type { VestingSchedule } from '@/store/types'
import { cn } from '@/utils/cn'
import { formatDate, relativeTime } from '@/utils/format'
import { toMs } from '@/utils/schedule'

const waitText = (schedule: VestingSchedule, nowMs: number): string => {
  if (nowMs < toMs(schedule.cliff)) {
    return `Cliff ends ${relativeTime(schedule.cliff, nowMs)}`
  }
  const { curve } = schedule
  return `Starts ${formatDate(curve.kind === 'linear' ? curve.start : curve.points[0].time)}`
}

export const GrantLock = ({
  className,
  nowMs,
  schedule,
}: {
  className?: string
  nowMs: number
  schedule: VestingSchedule
}): React.JSX.Element => (
  <span
    className={cn(
      'inline-flex max-w-36 items-center gap-1.5 text-right text-xs text-fg-muted',
      className,
    )}
  >
    <Lock size={14} /> {waitText(schedule, nowMs)}
  </span>
)
