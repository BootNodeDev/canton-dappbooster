import { StatusPill } from '@/components/StatusPill'
import { LockIcon } from '@/icons'
import type { GrantStatus } from '@/store/useVestingStore'

const LABEL: Record<GrantStatus, string> = {
  in_cliff: 'In cliff',
  not_started: 'Not started',
  vesting: 'Vesting',
  fully_vested: 'Fully vested',
}

const WAITING_ON: Record<'in_cliff' | 'not_started', string> = {
  in_cliff: 'Locked until cliff',
  not_started: 'Nothing vested yet',
}

export const GrantStatusPill = ({ status }: { status: GrantStatus }): React.JSX.Element => (
  <StatusPill tone={status === 'vesting' || status === 'fully_vested' ? 'success' : 'neutral'}>
    {LABEL[status]}
  </StatusPill>
)

// Stands in for the claim button while nothing is claimable, saying which wait it is.
export const GrantLock = ({
  status,
  className,
}: {
  status: 'in_cliff' | 'not_started'
  className?: string
}): React.JSX.Element => (
  <span className={className}>
    <LockIcon width={14} height={14} /> {WAITING_ON[status]}
  </span>
)
