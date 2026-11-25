import { Lock } from 'lucide-react'

import { cn } from '@/utils/cn'
import { formatDate, relativeTime } from '@/utils/format'
import { toMs, type VestingSchedule } from '@/utils/schedule'
import { standInClass } from '@/utils/standIn'

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
  <span className={cn(standInClass, 'max-w-36 text-right', className)}>
    <Lock size={14} /> {waitText(schedule, nowMs)}
  </span>
)
