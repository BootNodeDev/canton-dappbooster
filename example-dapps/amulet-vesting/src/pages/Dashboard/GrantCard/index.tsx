import { Eye, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { CompactAmount } from '@/components/CompactAmount'
import { CounterpartyId } from '@/components/CounterpartyId'
import { CurvePill } from '@/components/CurvePill'
import { GrantLock } from '@/components/GrantLock'
import { GrantRow } from '@/components/GrantRow'
import { GrantStatusPill } from '@/components/GrantStatusPill'
import { InfoTip } from '@/components/InfoTip'
import { Legend } from '@/components/Legend'
import { ScheduleBar } from '@/components/ScheduleBar'
import type { Grant, Role } from '@/store/types'
import type { GrantDerived } from '@/store/useVestingStore'
import { cn } from '@/utils/cn'
import { formatDate, formatPct, relativeTime } from '@/utils/format'
import { nextMilestone } from '@/utils/schedule'

interface GrantCardProps {
  className?: string
  derived: GrantDerived
  grant: Grant
  nowMs: number
  onCancel: (grant: Grant) => void
  onClaim: (grant: Grant) => void
  role: Role
}

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
    const curve = grant.schedule.curve
    const end = curve.kind === 'linear' ? curve.end : curve.points[curve.points.length - 1].time
    return { prefix: 'Ended', value: relativeTime(end, nowMs), date: formatDate(end) }
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
  className,
  onClaim,
  onCancel,
}: GrantCardProps): React.JSX.Element => {
  const curve = grant.schedule.curve
  const milestones = curve.kind === 'milestone' ? curve.points.map((p) => p.fraction) : undefined
  const counterparty = role === 'receiver' ? grant.creator : grant.receiver
  const meta = scheduleMeta(grant, derived, nowMs)
  const claimable = role === 'receiver' && derived.canClaim

  return (
    <GrantRow
      className={cn(claimable && '[--card-edge:var(--claimable-edge)]', className)}
      title={
        <Link to={`/grants/${grant.id}`} className="transition-colors hover:text-primary-strong">
          {grant.title}
        </Link>
      }
      badges={
        <>
          <CurvePill curve={curve} />
          <GrantStatusPill status={derived.status} />
        </>
      }
      detail={
        <span className="font-mono">
          <CounterpartyId party={counterparty} incoming={role === 'receiver'} />
        </span>
      }
      progress={
        <>
          <div className="mb-2 flex items-center justify-between gap-3 text-[0.8rem] text-fg-muted">
            <span>
              <b className="font-num font-semibold text-fg tabular-nums">
                {formatPct(derived.fraction)}
              </b>{' '}
              of{' '}
              <b className="font-num font-semibold text-fg tabular-nums">
                <CompactAmount value={grant.totalAmount} />
              </b>{' '}
              vested
            </span>
            <span className="flex items-center gap-1 text-right">
              {meta.prefix !== undefined && <span>{meta.prefix}</span>}
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
              { label: 'Claimed', value: derived.claimed, swatch: 'var(--bar-claimed)' },
              { label: 'Claimable', value: derived.claimable, swatch: 'var(--bar-claimable)' },
            ]}
          />
        </>
      }
      figure={
        role === 'receiver'
          ? { label: 'Claimable', amount: derived.claimable, dim: !claimable }
          : { label: 'Unvested', amount: derived.unvested }
      }
      action={
        role === 'receiver' ? (
          derived.locked ? (
            <GrantLock nowMs={nowMs} schedule={grant.schedule} />
          ) : (
            <Button size="sm" disabled={!derived.canClaim} onClick={() => onClaim(grant)}>
              Claim
            </Button>
          )
        ) : (
          <div className="flex gap-1">
            <Button
              aria-label="Grant details"
              size="icon"
              variant="ghost"
              asLink
              to={`/grants/${grant.id}`}
            >
              <Eye size={16} />
            </Button>
            <Button
              aria-label="Cancel grant"
              size="icon"
              variant="danger-ghost"
              onClick={() => onCancel(grant)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        )
      }
    />
  )
}
