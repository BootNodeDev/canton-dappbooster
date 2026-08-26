import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CounterpartyId } from '@/components/CounterpartyId'
import { InfoTip } from '@/components/InfoTip'
import { ScheduleBar } from '@/components/ScheduleBar'
import { StatusPill } from '@/components/StatusPill'
import type { Proposal } from '@/store/types'
import { formatDate, relativeTime } from '@/utils/format'
import { vestedFraction } from '@/utils/schedule'

// `direction` incoming means the acting party is the receiver and can accept; outgoing was sent as
// funder.
interface ProposalCardProps {
  direction: 'incoming' | 'outgoing'
  nowMs: number
  onAccept?: (proposal: Proposal) => void
  proposal: Proposal
}

export const ProposalCard = ({
  proposal,
  direction,
  nowMs,
  onAccept,
}: ProposalCardProps): React.JSX.Element => {
  const curve = proposal.schedule.curve
  const isMilestone = curve.kind === 'milestone'
  const milestones = curve.kind === 'milestone' ? curve.points.map((p) => p.fraction) : undefined
  const startFraction = vestedFraction(proposal.schedule, nowMs)
  const counterparty = direction === 'incoming' ? proposal.proposer : proposal.receiver

  return (
    <Card className="grid gap-5 p-5 md:grid-cols-[1.5fr_2.2fr_auto] md:items-center md:gap-7">
      <div className="min-w-0">
        <h3 className="text-base font-bold tracking-tight text-fg">{proposal.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={isMilestone ? 'milestone' : 'linear'}>
            {isMilestone ? 'Milestone' : 'Linear'}
          </StatusPill>
          <StatusPill tone={direction === 'incoming' ? 'warning' : 'neutral'}>
            {direction === 'incoming' ? 'Action needed' : 'Awaiting acceptance'}
          </StatusPill>
        </div>
        <div className="mt-2.5 font-mono text-xs text-fg-soft">
          <CounterpartyId party={counterparty} incoming={direction === 'incoming'} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between text-xs text-fg-muted">
          <span className="flex items-center gap-1">
            Cliff
            <InfoTip label={formatDate(proposal.schedule.cliff)}>
              {startFraction > 0 ? 'passed' : relativeTime(proposal.schedule.cliff, nowMs)}
            </InfoTip>
          </span>
        </div>
        <ScheduleBar vestedFraction={startFraction} claimedFraction={0} milestones={milestones} />
        {proposal.note !== undefined && (
          <p className="mt-3 text-sm text-fg-muted">{proposal.note}</p>
        )}
      </div>

      <div className="flex flex-col items-stretch gap-2.5 md:items-end">
        <div className="md:text-right">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
            Total
          </div>
          <AmountDisplay value={proposal.totalAmount} className="text-xl font-semibold text-fg" />
        </div>
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
