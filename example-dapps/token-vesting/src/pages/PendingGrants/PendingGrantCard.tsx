import { Button } from '@/components/Button'
import { CounterpartyId } from '@/components/CounterpartyId'
import { CurvePill } from '@/components/CurvePill'
import { GrantRow } from '@/components/GrantRow'
import { InfoTip } from '@/components/InfoTip'
import { ScheduleBar } from '@/components/ScheduleBar'
import { StatusPill } from '@/components/StatusPill'
import type { PendingGrant } from '@/store/types'
import type { BusyKind } from '@/store/useVestingStore'
import { formatDate, relativeTime } from '@/utils/format'
import { vestedFraction } from '@/utils/schedule'

// `direction` incoming means the acting party is the receiver and can accept; outgoing was sent as
// funder. `busy` is the submission this grant already has in flight: whichever exit it names, both
// controls are out until it settles, or the same grant could be accepted and declined at once.
interface PendingGrantCardProps {
  busy: BusyKind | undefined
  direction: 'incoming' | 'outgoing'
  nowMs: number
  onAccept: (pendingGrant: PendingGrant) => void
  onEnd: (pendingGrant: PendingGrant) => void
  pendingGrant: PendingGrant
}

export const PendingGrantCard = ({
  pendingGrant,
  direction,
  busy,
  nowMs,
  onAccept,
  onEnd,
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
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger-ghost"
              onClick={() => onEnd(pendingGrant)}
              pending={busy === 'end'}
              disabled={busy !== undefined}
              aria-label={`Decline ${pendingGrant.title}`}
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() => onAccept(pendingGrant)}
              pending={busy === 'accept'}
              disabled={busy !== undefined}
              aria-label={`Accept ${pendingGrant.title}`}
            >
              Accept
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="danger-ghost"
            onClick={() => onEnd(pendingGrant)}
            pending={busy === 'end'}
            disabled={busy !== undefined}
            aria-label={`Cancel ${pendingGrant.title}`}
          >
            Cancel
          </Button>
        )
      }
    />
  )
}
