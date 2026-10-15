import { StatusPill } from '@/components/StatusPill'
import type { GrantStatus } from '@/store/useVestingStore'

const LABEL: Record<GrantStatus, string> = {
  in_cliff: 'In cliff',
  not_started: 'Not started',
  vesting: 'Vesting',
  fully_vested: 'Fully vested',
}

export const GrantStatusPill = ({ status }: { status: GrantStatus }): React.JSX.Element => (
  <StatusPill tone={status === 'vesting' || status === 'fully_vested' ? 'success' : 'neutral'}>
    {LABEL[status]}
  </StatusPill>
)
