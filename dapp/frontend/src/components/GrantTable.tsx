import { Link } from 'react-router-dom'
import { formatCC, formatPct, shortenParty } from '@/lib/format'
import { MIN_GRANT_AMOUNT } from '@/lib/schedule'
import type { Grant, Role } from '@/store/types'
import type { GrantDerived } from '@/store/useVestingStore'
import { Button } from './Button'
import { Card } from './Card'
import { ScheduleBar } from './ScheduleBar'

export interface GrantRow {
  grant: Grant
  derived: GrantDerived
}

interface GrantTableProps {
  rows: GrantRow[]
  role: Role
  onClaim?: (grant: Grant) => void
  onCancel?: (grant: Grant) => void
}

const statusText = (d: GrantDerived): string =>
  d.status === 'in_cliff' ? 'in cliff' : d.status === 'fully_vested' ? 'vested' : 'vesting'

// Dense, table-driven view (Direction C) for users tracking many grants.
export const GrantTable = ({
  rows,
  role,
  onClaim,
  onCancel,
}: GrantTableProps): React.JSX.Element => (
  <Card className="overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[0.65rem] uppercase tracking-[0.08em] text-fg-muted">
            <th className="px-4 py-3 font-bold">Grant</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold">Progress</th>
            <th className="px-4 py-3 text-right font-bold">Total</th>
            <th className="px-4 py-3 text-right font-bold">Vested</th>
            <th className="px-4 py-3 text-right font-bold">
              {role === 'receiver' ? 'Claimable' : 'Unvested'}
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ grant, derived }) => {
            const claimedFraction =
              grant.totalAmount === 0 ? 0 : derived.claimed / grant.totalAmount
            const milestones =
              grant.schedule.curve.kind === 'milestone'
                ? grant.schedule.curve.points.map((p) => p.fraction)
                : undefined
            const canClaim = derived.claimable >= MIN_GRANT_AMOUNT
            return (
              <tr
                key={grant.id}
                className="border-b border-border/60 last:border-0 hover:bg-accent/[0.04]"
              >
                <td className="px-4 py-3.5">
                  <Link to={`/grants/${grant.id}`} className="font-bold text-fg hover:text-primary">
                    {grant.title}
                  </Link>
                  <div className="mt-0.5 font-mono text-[0.7rem] text-fg-soft">
                    {role === 'receiver'
                      ? shortenParty(grant.creator)
                      : shortenParty(grant.receiver)}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-fg-muted">
                    <span
                      className={`size-1.5 rounded-full ${derived.status === 'in_cliff' ? 'bg-fg-soft' : 'bg-success'}`}
                    />
                    {statusText(derived)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <ScheduleBar
                      className="w-28"
                      vestedFraction={derived.fraction}
                      claimedFraction={claimedFraction}
                      milestones={milestones}
                    />
                    <span className="w-9 font-mono text-[0.7rem] text-fg-muted">
                      {formatPct(derived.fraction)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right font-mono">{formatCC(grant.totalAmount)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-fg-muted">
                  {formatCC(derived.vested)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono">
                  {role === 'receiver' ? (
                    <span className="font-semibold text-success">
                      {formatCC(derived.claimable)}
                    </span>
                  ) : (
                    <span className="text-fg">{formatCC(derived.unvested)}</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  {role === 'receiver' ? (
                    <Button size="sm" disabled={!canClaim} onClick={() => onClaim?.(grant)}>
                      Claim
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => onCancel?.(grant)}>
                      Cancel
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </Card>
)
