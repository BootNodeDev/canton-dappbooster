import { StatusPill } from '@/components/StatusPill'
import { CheckIcon, LockIcon } from '@/icons'
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

// Stands in for the claim button while nothing is claimable.
export const GrantLock = ({ className }: { className?: string }): React.JSX.Element => (
  <span className={className}>
    <LockIcon width={14} height={14} /> Locked
  </span>
)

// Stands in for the claim button once the grant has been drained.
export const GrantClaimed = ({ className }: { className?: string }): React.JSX.Element => (
  <span className={className}>
    <CheckIcon width={14} height={14} /> Fully claimed
  </span>
)
