import { StatusPill } from '@/components/StatusPill'
import type { VestingCurve } from '@/store/types'

export const CurvePill = ({ curve }: { curve: VestingCurve }): React.JSX.Element =>
  curve.kind === 'milestone' ? (
    <StatusPill tone="milestone">Milestone</StatusPill>
  ) : (
    <StatusPill tone="linear">Linear</StatusPill>
  )
