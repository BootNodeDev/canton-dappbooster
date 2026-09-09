import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CounterpartyId } from '@/components/CounterpartyId'
import { CurvePill } from '@/components/CurvePill'
import { InfoTip } from '@/components/InfoTip'
import { ScheduleBar } from '@/components/ScheduleBar'
import { StatusPill } from '@/components/StatusPill'
import type { PendingGrant } from '@/store/types'
import { formatDate, relativeTime } from '@/utils/format'
import { vestedFraction } from '@/utils/schedule'

// `direction` incoming means the acting party is the receiver and can accept; outgoing was sent as
// funder. `ending` is a cancel or decline of this grant already in flight, which the card owner
// knows about and the dismissed dialog no longer does.
interface PendingGrantCardProps {
  direction: 'incoming' | 'outgoing'
  ending: boolean
  nowMs: number
  onAccept: (pendingGrant: PendingGrant) => void
  onEnd: (pendingGrant: PendingGrant) => void
  pendingGrant: PendingGrant
}

export const PendingGrantCard = ({
  pendingGrant,
  direction,
  ending,
  nowMs,
  onAccept,
  onEnd,
}: PendingGrantCardProps): React.JSX.Element => {
  const curve = pendingGrant.schedule.curve
  const milestones = curve.kind === 'milestone' ? curve.points.map((p) => p.fraction) : undefined
  const startFraction = vestedFraction(pendingGrant.schedule, nowMs)
  const counterparty = direction === 'incoming' ? pendingGrant.proposer : pendingGrant.receiver

  return (
    <Card className="grid gap-5 p-5 md:grid-cols-[1.5fr_2.2fr_auto] md:items-center md:gap-7">
      <div className="min-w-0">
        <h2 className="inline-block max-w-full truncate align-bottom text-base font-bold tracking-tight text-fg">
          {pendingGrant.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CurvePill curve={curve} />
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
            <InfoTip label={formatDate(pendingGrant.schedule.cliff)}>
              {startFraction > 0 ? 'passed' : relativeTime(pendingGrant.schedule.cliff, nowMs)}
            </InfoTip>
          </span>
        </div>
        <ScheduleBar vestedFraction={startFraction} claimedFraction={0} milestones={milestones} />
        {pendingGrant.note !== undefined && (
          <p className="mt-3 text-sm text-fg-muted">{pendingGrant.note}</p>
        )}
      </div>

      <div className="flex flex-col items-stretch gap-2.5 md:items-end">
        <div className="md:text-right">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
            Total
          </div>
          <AmountDisplay
            value={pendingGrant.totalAmount}
            className="text-xl font-semibold text-fg"
          />
        </div>
        {direction === 'incoming' ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger-ghost"
              className="flex-1 md:flex-none"
              onClick={() => onEnd(pendingGrant)}
              pending={ending}
              aria-label={`Decline ${pendingGrant.title}`}
            >
              Decline
            </Button>
            <Button
              size="sm"
              className="flex-1 md:flex-none"
              onClick={() => onAccept(pendingGrant)}
              disabled={ending}
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
            pending={ending}
            aria-label={`Cancel ${pendingGrant.title}`}
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  )
}
