import { useExplorerLink } from '@bootnodedev/canton-dappbooster'
import { Link } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CounterpartyId } from '@/components/CounterpartyId'
import { GrantLock, GrantStatusPill } from '@/components/GrantStatus'
import { InfoTip } from '@/components/InfoTip'
import { ScheduleBar } from '@/components/ScheduleBar'
import { StatusPill } from '@/components/StatusPill'
import { Legend } from '@/pages/Dashboard/GrantCard/Legend'
import type { Grant, Role } from '@/store/types'
import type { GrantDerived } from '@/store/useVestingStore'
import { EXPLORER } from '@/utils/config'
import { formatDate, formatPct, relativeTime } from '@/utils/format'
import { nextMilestone } from '@/utils/schedule'

interface GrantCardProps {
  derived: GrantDerived
  grant: Grant
  nowMs: number
  onCancel?: (grant: Grant) => void
  onClaim?: (grant: Grant) => void
  role: Role
}

// The relative wording is the readable one, so the exact date rides along in a tooltip.
const scheduleMeta = (
  grant: Grant,
  derived: GrantDerived,
  nowMs: number,
): { prefix?: string; value: string; date?: string } => {
  if (derived.status === 'in_cliff') {
    return {
      prefix: 'Cliff',
      value: relativeTime(grant.schedule.cliff, nowMs),
      date: formatDate(grant.schedule.cliff),
    }
  }
  if (derived.status === 'fully_vested') {
    return { value: 'Fully vested' }
  }
  if (grant.schedule.curve.kind === 'linear') {
    return { prefix: 'Ends', value: formatDate(grant.schedule.curve.end) }
  }
  const next = nextMilestone(grant.schedule, nowMs)
  return next === undefined
    ? { value: 'Final milestone pending' }
    : { prefix: 'Next', value: formatDate(next.time) }
}

export const GrantCard = ({
  grant,
  derived,
  role,
  nowMs,
  onClaim,
  onCancel,
}: GrantCardProps): React.JSX.Element => {
  const curve = grant.schedule.curve
  const isMilestone = curve.kind === 'milestone'
  const milestones = curve.kind === 'milestone' ? curve.points.map((p) => p.fraction) : undefined
  const counterparty = role === 'receiver' ? grant.creator : grant.receiver
  const explorerLink = useExplorerLink(EXPLORER)
  const meta = scheduleMeta(grant, derived, nowMs)

  return (
    <Card className="grid gap-5 p-5 md:grid-cols-[1.5fr_2.2fr_auto] md:items-center md:gap-7">
      <div className="min-w-0">
        <Link
          to={`/grants/${grant.id}`}
          className="text-base font-bold tracking-tight text-fg transition-colors hover:text-primary"
        >
          {grant.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={isMilestone ? 'milestone' : 'linear'}>
            {isMilestone ? 'Milestone' : 'Linear'}
          </StatusPill>
          <GrantStatusPill status={derived.status} />
        </div>
        <div className="mt-2.5 font-mono text-xs text-fg-soft">
          <CounterpartyId
            party={counterparty}
            incoming={role === 'receiver'}
            href={explorerLink(counterparty)}
          />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between text-xs text-fg-muted">
          <span>Vested {formatPct(derived.fraction)}</span>
          <span className="flex items-center gap-1">
            {meta.prefix}
            {meta.date === undefined ? (
              meta.value
            ) : (
              <InfoTip label={meta.date}>{meta.value}</InfoTip>
            )}
          </span>
        </div>
        <ScheduleBar
          vestedFraction={derived.fraction}
          claimedFraction={derived.claimedFraction}
          milestones={milestones}
        />
        <Legend
          className="mt-3"
          items={[
            { label: 'Vested', value: derived.vested, swatch: 'bg-[image:var(--gradient-brand)]' },
            { label: 'Claimable', value: derived.claimable, swatch: 'bg-success' },
            { label: 'Claimed', value: derived.claimed, swatch: 'bg-surface-2' },
          ]}
        />
      </div>

      <div className="flex flex-col items-stretch gap-2.5 md:items-end">
        {role === 'receiver' ? (
          <>
            <div className="md:text-right">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
                Claimable
              </div>
              <AmountDisplay
                value={derived.claimable}
                className="text-xl font-semibold text-success"
              />
            </div>
            {derived.locked ? (
              <GrantLock
                status={derived.status === 'in_cliff' ? 'in_cliff' : 'not_started'}
                className="inline-flex items-center justify-center gap-1.5 font-mono text-xs text-fg-muted"
              />
            ) : (
              <Button
                size="sm"
                disabled={!derived.canClaim}
                onClick={() => onClaim?.(grant)}
                className="md:w-auto"
              >
                Claim
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="md:text-right">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
                Unvested
              </div>
              <AmountDisplay value={derived.unvested} className="text-xl font-semibold text-fg" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" asLink to={`/grants/${grant.id}`}>
                Details
              </Button>
              <Button size="sm" variant="danger" onClick={() => onCancel?.(grant)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
