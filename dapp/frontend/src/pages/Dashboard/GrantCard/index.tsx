import { Eye, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CounterpartyId } from '@/components/CounterpartyId'
import { CurvePill } from '@/components/CurvePill'
import { GrantLock } from '@/components/GrantLock'
import { GrantStatusPill } from '@/components/GrantStatusPill'
import { InfoTip } from '@/components/InfoTip'
import { ScheduleBar } from '@/components/ScheduleBar'
import { Legend } from '@/pages/Dashboard/GrantCard/Legend'
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

  return (
    <Card
      className={cn(
        'grid gap-5 p-5 md:grid-cols-[1.5fr_2.2fr_auto] md:items-center md:gap-7',
        className,
      )}
    >
      <div className="min-w-0">
        <h2>
          <Link
            to={`/grants/${grant.id}`}
            className="block truncate text-base font-bold tracking-tight text-fg transition-colors hover:text-primary-strong"
          >
            {grant.title}
          </Link>
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CurvePill curve={curve} />
          <GrantStatusPill status={derived.status} />
        </div>
        <div className="mt-2.5 font-mono text-xs text-fg-soft">
          <CounterpartyId party={counterparty} incoming={role === 'receiver'} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between text-xs text-fg-muted">
          <span>Vested {formatPct(derived.fraction)}</span>
          <span className="flex items-center gap-1">
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
              <GrantLock className="justify-center" />
            ) : (
              <Button
                size="sm"
                disabled={!derived.canClaim}
                onClick={() => onClaim(grant)}
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
          </>
        )}
      </div>
    </Card>
  )
}
