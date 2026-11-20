import { AmountDisplay } from '@/components/AmountDisplay'
import { Card } from '@/components/Card'
import { ScheduleBar } from '@/components/ScheduleBar'
import { Legend } from '@/pages/Dashboard/Legend'
import type { Role } from '@/store/types'
import { toNumber } from '@/utils/amount'
import { formatPct } from '@/utils/format'

export interface Totals {
  claimable: string
  claimed: string
  total: string
  unvested: string
  vested: string
}

interface SummaryProps {
  claimableCount: number
  grantCount: number
  role: Role
  totals: Totals
}

const share = (part: string, whole: string): number =>
  toNumber(whole) > 0 ? toNumber(part) / toNumber(whole) : 0

const plural = (count: number): string => `${count} ${count === 1 ? 'grant' : 'grants'}`

const Stat = ({
  amount,
  count = false,
  label,
  note,
}: {
  amount: string
  count?: boolean
  label: string
  note?: string
}): React.JSX.Element => (
  <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 first:pt-0 sm:block sm:border-0 sm:py-0">
    <div className="text-[0.85rem] font-semibold text-fg-muted">{label}</div>
    <AmountDisplay
      value={amount}
      count={count}
      markSize="small"
      className="text-lg font-semibold tracking-tight text-fg sm:mt-1.5 sm:text-2xl"
    />
    {note !== undefined && <div className="mt-1 text-xs text-fg-soft max-sm:hidden">{note}</div>}
  </div>
)

// The headline figure for the lens, then the rest of the totals with a bar splitting the whole.
export const Summary = ({
  claimableCount,
  grantCount,
  role,
  totals,
}: SummaryProps): React.JSX.Element => {
  const receiving = role === 'receiver'

  return (
    <section aria-label="Summary" className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card
        tone="hero"
        className="flex flex-col justify-between gap-7 overflow-hidden px-6 py-6 sm:px-7"
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--hero-muted)]">
            <span className="size-2 rounded-full bg-[var(--hero-dot)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--hero-dot)_22%,transparent)]" />
            {receiving ? 'Claimable now' : 'Total committed'}
          </div>
          <AmountDisplay
            value={receiving ? totals.claimable : totals.total}
            markSize="small"
            className="mt-3 text-[2.4rem] leading-none font-semibold tracking-tight text-[var(--hero-figure)] sm:text-[3rem]"
          />
        </div>
        <p className="text-sm text-[var(--hero-muted)]">
          {receiving ? (
            <>
              Across <b className="font-semibold text-[var(--hero-fg)]">{plural(claimableCount)}</b>{' '}
              you can claim today
            </>
          ) : (
            <>
              <b className="font-semibold text-[var(--hero-fg)]">{plural(grantCount)}</b> funded
            </>
          )}
        </p>
      </Card>

      <Card className="flex flex-col justify-between gap-6 px-5 py-5 sm:px-7 sm:py-6">
        <div className="grid sm:grid-cols-3 sm:gap-4">
          {receiving ? (
            <>
              <Stat
                label="Total granted"
                amount={totals.total}
                note={`${plural(grantCount)} active`}
              />
              <Stat
                label="Vested to date"
                amount={totals.vested}
                note={`${formatPct(share(totals.vested, totals.total))} of total`}
              />
              <Stat
                label="Already claimed"
                amount={totals.claimed}
                note={`${formatPct(share(totals.claimed, totals.total))} of total`}
              />
            </>
          ) : (
            <>
              <Stat
                label="Vested to date"
                amount={totals.vested}
                note={`${formatPct(share(totals.vested, totals.total))} of total`}
              />
              <Stat label="Unvested (clawbackable)" amount={totals.unvested} />
              <Stat label="Active grants" amount={String(grantCount)} count />
            </>
          )}
        </div>
        <div>
          <ScheduleBar
            claimedFraction={share(totals.claimed, totals.total)}
            vestedFraction={share(totals.vested, totals.total)}
          />
          <Legend
            className="mt-3"
            items={[
              { label: 'Claimed', swatch: 'var(--bar-claimed)' },
              { label: 'Claimable now', swatch: 'var(--bar-claimable)' },
              { label: 'Not vested yet', swatch: 'var(--bar-track)', value: totals.unvested },
            ]}
          />
        </div>
      </Card>
    </section>
  )
}
