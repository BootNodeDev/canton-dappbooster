import { Identifier } from '@bootnodedev/canton-dappbooster'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ClaimRecord } from '@/backend/VestingBackend'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { CancelGrant } from '@/components/CancelGrant'
import { Card } from '@/components/Card'
import { Claim } from '@/components/Claim'
import { CompactAmount } from '@/components/CompactAmount'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { CounterpartyId } from '@/components/CounterpartyId'
import { CurvePill } from '@/components/CurvePill'
import { EmptyState } from '@/components/EmptyState'
import { GrantLock } from '@/components/GrantLock'
import { GrantStatusPill } from '@/components/GrantStatusPill'
import { Legend, type LegendItem } from '@/components/Legend'
import { Loading } from '@/components/Loading'
import { ScheduleCurve } from '@/components/ScheduleCurve'
import { Spinner } from '@/components/Spinner'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { lensSearch, useRoleLens } from '@/hooks/useRoleLens'
import { KpiCard } from '@/pages/GrantDetail/KpiCard'
import { MilestoneTimeline } from '@/pages/GrantDetail/MilestoneTimeline'
import { deriveGrant, grantBacking, useVesting, useVestingStore } from '@/store/useVestingStore'
import { useNow } from '@/utils/clock'
import { formatDate } from '@/utils/format'

const titleClass = 'font-heading text-base font-bold text-fg'
const rowClass = 'flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0'

const CURVE_LEGEND: LegendItem[] = [
  { label: 'Vested', swatch: 'var(--chart-line)' },
  { label: 'Still to vest', swatch: 'color-mix(in oklab, var(--chart-line) 55%, transparent)' },
]

export const GrantDetail = (): React.JSX.Element => {
  const nowMs = useNow()
  const navigate = useNavigate()
  const [role] = useRoleLens()
  const search = lensSearch(role)
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const { backend, partyId, sessionPending } = useVesting()
  const grant = useVestingStore((s) => s.grants.find((g) => g.id === id))
  const loading = useVestingStore((s) => s.loading)
  const busy = useVestingStore((s) => s.busy)
  const withdraw = useVestingStore((s) => s.withdraw)
  const cancel = useVestingStore((s) => s.cancel)
  const [claimOpen, setClaimOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [claims, setClaims] = useState<ClaimRecord[] | undefined>(undefined)

  const contractId = grant?.id

  useDocumentTitle(grant?.title ?? 'Grant')

  useEffect(() => {
    if (backend === undefined || partyId === '' || contractId === undefined) {
      return
    }
    let cancelled = false
    setClaims(undefined)
    void backend.claimHistory(partyId, contractId).then(
      (records) => {
        if (!cancelled) setClaims(records)
      },
      () => {
        if (!cancelled) setClaims([])
      },
    )
    return () => {
      cancelled = true
    }
  }, [backend, partyId, contractId])

  if (backend === undefined) {
    return sessionPending ? <Loading /> : <ConnectPrompt />
  }

  if (grant === undefined && loading) {
    return <Loading />
  }

  if (grant === undefined) {
    return (
      <EmptyState
        level={1}
        title="Grant not found"
        description="It may have been fully claimed or cancelled."
        action={
          <Button asLink to={`/${search}`} size="sm">
            Back to grants
          </Button>
        }
      />
    )
  }

  const derived = deriveGrant(grant, nowMs)
  // Either dialog stays dismissible over the wallet prompt, so without this the control behind it
  // would offer a second write against a contract the first is about to archive.
  const inFlight = busy.get(grant.id) !== undefined
  const isReceiver = grant.receiver === partyId
  const isCreator = grant.creator === partyId
  const isMilestone = grant.schedule.curve.kind === 'milestone'

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        aria-label="Back to grants"
        onClick={() => (location.key === 'default' ? navigate(`/${search}`) : navigate(-1))}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={16} /> Grants
      </button>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-[1.75rem] font-extrabold leading-tight text-fg sm:text-[2rem]">
            {grant.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CurvePill curve={grant.schedule.curve} />
            <GrantStatusPill status={derived.status} />
            <span className="font-mono text-xs text-fg-soft">
              <CounterpartyId
                incoming={isReceiver}
                party={isReceiver ? grant.creator : grant.receiver}
              />
            </span>
          </div>
        </div>
        <div className="flex gap-2.5">
          {isReceiver &&
            (derived.locked ? (
              <GrantLock className="self-center" nowMs={nowMs} schedule={grant.schedule} />
            ) : (
              <Button
                size="lg"
                disabled={!derived.canClaim}
                pending={inFlight}
                onClick={() => setClaimOpen(true)}
              >
                Claim <CompactAmount value={derived.claimable} plain /> DBT
              </Button>
            ))}
          {isCreator && (
            <Button
              size="lg"
              variant="danger"
              disabled={inFlight}
              onClick={() => setCancelOpen(true)}
            >
              Cancel grant
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
        <KpiCard lead label="Claimable now" amount={derived.claimable} />
        <KpiCard label="Vested" amount={derived.vested} />
        <KpiCard label="Claimed" amount={derived.claimed} />
        <KpiCard label="Not vested yet" amount={derived.unvested} />
        <KpiCard label="Total" amount={grant.totalAmount} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className={titleClass}>Vesting curve</h2>
            <Legend items={CURVE_LEGEND} />
          </div>
          <div className="mt-5">
            <ScheduleCurve schedule={grant.schedule} nowMs={nowMs} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className={titleClass}>{isMilestone ? 'Milestones' : 'Terms'}</h2>
          <div className="mt-4">
            {isMilestone ? (
              <MilestoneTimeline
                schedule={grant.schedule}
                total={grant.totalAmount}
                nowMs={nowMs}
              />
            ) : (
              <dl className="divide-y divide-border text-sm">
                {grant.schedule.curve.kind === 'linear' && (
                  <>
                    <div className={rowClass}>
                      <dt className="text-fg-muted">Start</dt>
                      <dd className="font-semibold text-fg">
                        {formatDate(grant.schedule.curve.start)}
                      </dd>
                    </div>
                    <div className={rowClass}>
                      <dt className="text-fg-muted">End</dt>
                      <dd className="font-semibold text-fg">
                        {formatDate(grant.schedule.curve.end)}
                      </dd>
                    </div>
                  </>
                )}
                <div className={rowClass}>
                  <dt className="text-fg-muted">Cliff</dt>
                  <dd className="font-semibold text-fg">{formatDate(grant.schedule.cliff)}</dd>
                </div>
              </dl>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className={titleClass}>Parties</h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            {(
              [
                ['Provider', grant.provider],
                ['Funder', grant.creator],
                ['Receiver', grant.receiver],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className={rowClass}>
                <dt className="text-fg-muted">{label}</dt>
                <dd className="m-0 min-w-0">
                  <Identifier
                    value={value}
                    label={`${label.toLowerCase()} party id`}
                    className="text-xs"
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className={titleClass}>Claim history</h2>
            {claims !== undefined && claims.length > 0 && (
              <span className="text-sm text-fg-muted">
                {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
              </span>
            )}
          </div>
          <div className="mt-4 h-40 overflow-y-auto">
            {claims === undefined ? (
              <div role="status" className="flex h-full items-center justify-center text-fg-muted">
                <Spinner size={20} />
                <span className="sr-only">Loading claim history</span>
              </div>
            ) : claims.length === 0 ? (
              <p className="text-sm text-fg-muted">No claims yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 pr-1">
                {claims.map((record) => (
                  <li
                    key={record.grant.id}
                    className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-0"
                  >
                    <span className="text-fg-muted">{formatDate(record.at)}</span>
                    <AmountDisplay
                      value={record.amount}
                      markSize="small"
                      className="font-semibold"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {claimOpen && (
        <Claim
          onClose={() => setClaimOpen(false)}
          title="Claim vested DBT"
          available={derived.claimable}
          backing={grantBacking(grant)}
          onConfirm={async (amount) => {
            const next = await withdraw(backend, partyId, grant.id, amount)
            if (next === undefined) {
              navigate(`/${search}`, { replace: true })
            } else if (next !== grant.id) {
              navigate(`/grants/${next}${search}`, { replace: true })
            }
          }}
        />
      )}

      {cancelOpen && (
        <CancelGrant
          onClose={() => setCancelOpen(false)}
          grant={grant}
          nowMs={nowMs}
          description="Vested-but-unclaimed DBT becomes a residual claim for the receiver; the contract is archived."
          successMessage="Grant cancelled"
          onConfirm={async () => {
            await cancel(backend, partyId, grant.id)
            navigate(`/${search}`, { replace: true })
          }}
        />
      )}
    </div>
  )
}
