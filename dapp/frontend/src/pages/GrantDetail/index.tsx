import { Identifier } from '@bootnodedev/canton-dappbooster'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ClaimRecord } from '@/backend/VestingBackend'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { CancelGrant } from '@/components/CancelGrant'
import { Card } from '@/components/Card'
import { Claim } from '@/components/Claim'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { EmptyState } from '@/components/EmptyState'
import { GrantClaimed, GrantLock, GrantStatusPill } from '@/components/GrantStatus'
import { KpiCard } from '@/components/KpiCard'
import { Loading } from '@/components/Loading'
import { ScheduleCurve } from '@/components/ScheduleCurve'
import { StatusPill } from '@/components/StatusPill'
import { ArrowLeftIcon, SpinnerIcon } from '@/icons'
import { MilestoneTimeline } from '@/pages/GrantDetail/MilestoneTimeline'
import { useBackend } from '@/providers/Backend'
import { deriveGrant, useVesting, useVestingStore } from '@/store/useVestingStore'
import { useNow } from '@/utils/clock'
import { formatCCCompact, formatDate } from '@/utils/format'
import { copyToast } from '@/utils/toast'

export const GrantDetail = (): React.JSX.Element => {
  const nowMs = useNow()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const { backend, partyId } = useVesting()
  const { sessionPending } = useBackend()
  const grant = useVestingStore((s) => s.grants.find((g) => g.id === id))
  const loading = useVestingStore((s) => s.loading)
  const withdraw = useVestingStore((s) => s.withdraw)
  const cancel = useVestingStore((s) => s.cancel)
  const [claimOpen, setClaimOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  // Undefined until the read lands, which is what the card shows a spinner for. Re-read whenever
  // the contract id changes, since a claim of ours is exactly what replaces it.
  const [claims, setClaims] = useState<ClaimRecord[] | undefined>(undefined)

  const contractId = grant?.id

  useEffect(() => {
    if (backend === undefined || partyId === '' || contractId === undefined) {
      return
    }
    let cancelled = false
    setClaims(undefined)
    void backend.claimHistory(partyId).then(
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

  // A claim consumes the contract and creates its successor, so a grant's history is its ancestry:
  // walk back from the id on screen. Matching on the fields instead merges two grants a funder made
  // identical, and the walk arrives newest-first, which is the order the card wants.
  const grantClaims = useMemo(() => {
    if (claims === undefined || contractId === undefined) {
      return undefined
    }
    const bySuccessor = new Map(claims.map((record) => [record.grant.id, record]))
    const history: ClaimRecord[] = []
    for (
      let record = bySuccessor.get(contractId);
      record !== undefined;
      record = bySuccessor.get(record.replaces)
    ) {
      history.push(record)
    }
    return history
  }, [claims, contractId])

  if (backend === undefined) {
    return sessionPending ? <Loading /> : <ConnectPrompt />
  }

  // Without this a direct link reads as a missing grant until the first ACS read lands.
  if (grant === undefined && loading) {
    return <Loading />
  }

  if (grant === undefined) {
    return (
      <EmptyState
        title="Grant not found"
        description="It may have been fully claimed or cancelled."
        action={
          <Button asLink to="/" size="sm">
            Back to grants
          </Button>
        }
      />
    )
  }

  const derived = deriveGrant(grant, nowMs)
  const isReceiver = grant.receiver === partyId
  const isCreator = grant.creator === partyId
  const isMilestone = grant.schedule.curve.kind === 'milestone'

  return (
    <div className="flex flex-col gap-6">
      {/* A real history back, so the dashboard's lens and scroll return with it; a deep link has no
          entry to go back to, hence the fallback. */}
      <button
        type="button"
        onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeftIcon width={16} height={16} /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-fg">{grant.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill tone={isMilestone ? 'milestone' : 'linear'}>
              {isMilestone ? 'Milestone' : 'Linear'}
            </StatusPill>
            <GrantStatusPill status={derived.status} />
          </div>
        </div>
        <div className="flex gap-2.5">
          {isReceiver &&
            (derived.fullyClaimed ? (
              <GrantClaimed className="inline-flex items-center gap-1.5 self-center font-mono text-xs text-fg-muted" />
            ) : derived.locked ? (
              <GrantLock className="inline-flex items-center gap-1.5 self-center font-mono text-xs text-fg-muted" />
            ) : (
              <Button disabled={!derived.canClaim} onClick={() => setClaimOpen(true)}>
                Claim {formatCCCompact(derived.claimable)} CC
              </Button>
            ))}
          {isCreator && (
            <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel grant
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="Total" amount={grant.totalAmount} />
        <KpiCard label="Vested" amount={derived.vested} />
        <KpiCard label="Claimable" amount={derived.claimable} tone="success" />
        <KpiCard label="Claimed" amount={derived.claimed} tone="muted" />
        <KpiCard label="Unvested" amount={derived.unvested} tone="muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Vesting curve</h2>
          <div className="mt-4">
            <ScheduleCurve schedule={grant.schedule} nowMs={nowMs} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">{isMilestone ? 'Milestones' : 'Terms'}</h2>
          <div className="mt-4">
            {isMilestone ? (
              <MilestoneTimeline
                schedule={grant.schedule}
                total={grant.totalAmount}
                nowMs={nowMs}
              />
            ) : (
              <dl className="flex flex-col gap-2.5 text-sm">
                {grant.schedule.curve.kind === 'linear' && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-fg-muted">Start</dt>
                      <dd className="font-mono text-fg">
                        {formatDate(grant.schedule.curve.start)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-fg-muted">End</dt>
                      <dd className="font-mono text-fg">{formatDate(grant.schedule.curve.end)}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Cliff</dt>
                  <dd className="font-mono text-fg">{formatDate(grant.schedule.cliff)}</dd>
                </div>
              </dl>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Parties</h2>
          <dl className="mt-4 flex flex-col gap-2.5 text-sm">
            {(
              [
                ['Provider', grant.provider],
                ['Funder', grant.creator],
                ['Receiver', grant.receiver],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="m-0 min-w-0">
                  <Identifier
                    value={value}
                    label={`${label.toLowerCase()} party id`}
                    announce={false}
                    onCopy={copyToast(`${label} party id`)}
                    className="text-xs"
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Withdraw history</h2>
          <div className="mt-4 h-40 overflow-y-auto">
            {grantClaims === undefined ? (
              <div className="flex h-full items-center justify-center text-fg-muted">
                <SpinnerIcon width={20} height={20} />
              </div>
            ) : grantClaims.length === 0 ? (
              <p className="text-sm text-fg-muted">No withdrawals yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 pr-1">
                {grantClaims.map((record) => (
                  <li key={record.grant.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-fg-muted">{formatDate(record.at)}</span>
                    <AmountDisplay value={record.amount} className="font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {claimOpen && (
        <Claim
          open
          onClose={() => setClaimOpen(false)}
          title="Claim vested CC"
          available={derived.claimable}
          onConfirm={async (amount) => {
            // The claim archives this contract and re-creates it, so the URL follows the successor.
            const next = await withdraw(backend, partyId, grant.id, amount)
            if (next !== undefined && next !== grant.id) {
              navigate(`/grants/${next}`, { replace: true })
            }
          }}
        />
      )}

      {cancelOpen && (
        <CancelGrant
          open
          onClose={() => setCancelOpen(false)}
          grant={grant}
          nowMs={nowMs}
          description="Vested-but-unclaimed CC becomes a residual claim for the receiver; the contract is archived."
          successMessage="Grant cancelled"
          onConfirm={async () => {
            // Cancel archives the grant for good, so staying here would read "Grant not found".
            await cancel(backend, partyId, grant.id)
            navigate('/', { replace: true })
          }}
        />
      )}
    </div>
  )
}
