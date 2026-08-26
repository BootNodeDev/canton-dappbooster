import { StatusPill } from '@/components/StatusPill'
import type { VestingCurve } from '@/utils/schedule'

// The tone and the wording travelled together through three pages, so they live together here.
export const CurvePill = ({ curve }: { curve: VestingCurve }): React.JSX.Element =>
  curve.kind === 'milestone' ? (
    <StatusPill tone="milestone">Milestone</StatusPill>
  ) : (
    <StatusPill tone="linear">Linear</StatusPill>
  )
