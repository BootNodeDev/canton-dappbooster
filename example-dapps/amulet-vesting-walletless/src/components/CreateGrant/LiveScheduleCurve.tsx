import { ScheduleCurve } from '@/components/ScheduleCurve'
import type { VestingSchedule } from '@/store/types'
import { useNow } from '@/utils/clock'

// Isolates the clock to the preview marker so typing in the form does not reconcile the whole page
// each tick.
export const LiveScheduleCurve = ({
  schedule,
}: {
  schedule: VestingSchedule
}): React.JSX.Element => <ScheduleCurve schedule={schedule} nowMs={useNow()} />
