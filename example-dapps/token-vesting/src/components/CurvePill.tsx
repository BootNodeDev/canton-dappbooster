import { StatusPill } from '@/components/StatusPill'
import type { VestingCurve } from '@/utils/schedule'

export const CurvePill = ({ curve }: { curve: VestingCurve }): React.JSX.Element => (
  <StatusPill tone="curve">{curve.kind === 'milestone' ? 'Milestone' : 'Linear'}</StatusPill>
)
