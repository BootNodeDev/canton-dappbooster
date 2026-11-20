import { ScheduleCurve } from '@/components/ScheduleCurve'
import type { VestingSchedule } from '@/store/types'
import { useNow } from '@/utils/clock'

// A component of its own so each clock tick re-renders the curve, not the whole form.
export const LiveScheduleCurve = ({
  compact,
  schedule,
}: {
  compact?: boolean
  schedule: VestingSchedule
}): React.JSX.Element => <ScheduleCurve compact={compact} schedule={schedule} nowMs={useNow()} />
