import { ScheduleCurve } from '@/components/ScheduleCurve'
import { useNow } from '@/utils/clock'
import type { VestingSchedule } from '@/utils/schedule'

// Isolates the clock to the preview marker so typing in the form does not reconcile the whole page
// each tick.
export const LiveScheduleCurve = ({
  compact,
  schedule,
}: {
  compact?: boolean
  schedule: VestingSchedule
}): React.JSX.Element => <ScheduleCurve compact={compact} schedule={schedule} nowMs={useNow()} />
