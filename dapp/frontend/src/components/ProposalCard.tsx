import { formatCC, formatDate, relativeTime, shortenParty } from '@/lib/format'
import { vestedFraction } from '@/lib/schedule'
import type { Proposal } from '@/store/types'
import { Button } from './Button'
import { Card } from './Card'
import { StatusPill } from './StatusPill'

interface ProposalCardProps {
  proposal: Proposal
  // 'incoming' — acting party is the receiver (can accept); 'outgoing' — sent as funder.
  direction: 'incoming' | 'outgoing'
  nowMs: number
  onAccept?: (proposal: Proposal) => void
}

export const ProposalCard = ({
  proposal,
  direction,
  nowMs,
  onAccept,
}: ProposalCardProps): React.JSX.Element => {
  const isMilestone = proposal.schedule.curve.kind === 'milestone'
  const startFraction = vestedFraction(proposal.schedule, nowMs)
  const counterparty = direction === 'incoming' ? proposal.proposer : proposal.receiver

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-fg">{proposal.title}</h3>
          <div className="mt-1 font-mono text-xs text-fg-soft">
            {direction === 'incoming' ? 'from' : 'to'} {shortenParty(counterparty)}
          </div>
        </div>
        <StatusPill tone={direction === 'incoming' ? 'warning' : 'neutral'}>
          {direction === 'incoming' ? 'Action needed' : 'Awaiting acceptance'}
        </StatusPill>
      </div>

      <dl className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-bg/40 p-3.5 text-sm">
        <div>
          <dt className="text-xs text-fg-muted">Total</dt>
          <dd className="mt-0.5 font-mono font-semibold text-fg">
            {formatCC(proposal.totalAmount)} CC
          </dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Type</dt>
          <dd className="mt-0.5 font-semibold text-fg">{isMilestone ? 'Milestone' : 'Linear'}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Cliff</dt>
          <dd className="mt-0.5 font-semibold text-fg">
            {startFraction > 0 ? 'Passed' : relativeTime(proposal.schedule.cliff, nowMs)}
          </dd>
        </div>
      </dl>

      {proposal.note !== undefined && <p className="text-sm text-fg-muted">{proposal.note}</p>}

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-fg-soft">
          Cliff {formatDate(proposal.schedule.cliff)}
        </span>
        {direction === 'incoming' ? (
          <Button size="sm" onClick={() => onAccept?.(proposal)}>
            Accept &amp; fund
          </Button>
        ) : (
          <span className="font-mono text-xs text-fg-muted">awaiting acceptance</span>
        )}
      </div>
    </Card>
  )
}
