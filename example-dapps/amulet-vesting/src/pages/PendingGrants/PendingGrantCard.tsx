import { Button } from '@/components/Button'
import { CounterpartyId } from '@/components/CounterpartyId'
import { CurvePill } from '@/components/CurvePill'
import { GrantRow } from '@/components/GrantRow'
import { InfoTip } from '@/components/InfoTip'
import { ScheduleBar } from '@/components/ScheduleBar'
import { StatusPill } from '@/components/StatusPill'
import type { PendingGrant } from '@/store/types'
import { formatDate, relativeTime } from '@/utils/format'
import { vestedFraction } from '@/utils/schedule'

// `direction` incoming means the acting party is the receiver and can accept; outgoing was sent as
// funder.
interface PendingGrantCardProps {
  direction: 'incoming' | 'outgoing'
  nowMs: number
  onAccept: (pendingGrant: PendingGrant) => void
  pendingGrant: PendingGrant
}

export const PendingGrantCard = ({
  pendingGrant,
  direction,
  nowMs,
  onAccept,
}: PendingGrantCardProps): React.JSX.Element => {
  const curve = pendingGrant.schedule.curve
  const milestones = curve.kind === 'milestone' ? curve.points.map((p) => p.fraction) : undefined
  const startFraction = vestedFraction(pendingGrant.schedule, nowMs)
  const counterparty = direction === 'incoming' ? pendingGrant.proposer : pendingGrant.receiver

  return (
    <GrantRow
      title={pendingGrant.title}
      badges={
        <>
          <CurvePill curve={curve} />
          <StatusPill tone={direction === 'incoming' ? 'warning' : 'neutral'}>
            {direction === 'incoming' ? 'Waiting for you' : 'Awaiting acceptance'}
          </StatusPill>
        </>
      }
      detail={
        <span className="font-mono">
          <CounterpartyId party={counterparty} incoming={direction === 'incoming'} />
        </span>
      }
      progress={
        <>
          <div className="mb-2 flex items-center justify-between text-[0.8rem] text-fg-muted">
            <span className="flex items-center gap-1">
              Cliff
              <InfoTip label={formatDate(pendingGrant.schedule.cliff)}>
                {startFraction > 0 ? 'passed' : relativeTime(pendingGrant.schedule.cliff, nowMs)}
              </InfoTip>
            </span>
          </div>
          <ScheduleBar vestedFraction={startFraction} claimedFraction={0} milestones={milestones} />
          {pendingGrant.note !== undefined && (
            <p className="mt-3 text-sm text-fg-muted">{pendingGrant.note}</p>
          )}
        </>
      }
      figure={{ label: 'Total', amount: pendingGrant.totalAmount }}
      action={
        direction === 'incoming' ? (
          <Button size="sm" onClick={() => onAccept(pendingGrant)}>
            Accept
          </Button>
        ) : (
          <span className="text-xs text-fg-muted">Not accepted yet</span>
        )
      }
    />
  )
}
