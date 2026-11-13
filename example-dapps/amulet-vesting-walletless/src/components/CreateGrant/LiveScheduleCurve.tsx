import { ScheduleCurve } from '@/components/ScheduleCurve'
import type { VestingSchedule } from '@/store/types'
import { useNow } from '@/utils/clock'

// A component of its own so each clock tick re-renders the curve, not the whole form.
export const LiveScheduleCurve = ({
  schedule,
}: {
  schedule: VestingSchedule
}): React.JSX.Element => <ScheduleCurve schedule={schedule} nowMs={useNow()} />
