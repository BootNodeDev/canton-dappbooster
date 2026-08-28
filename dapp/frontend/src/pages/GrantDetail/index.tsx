import { Identifier } from '@bootnodedev/canton-dappbooster'
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
import { CurvePill } from '@/components/CurvePill'
import { EmptyState } from '@/components/EmptyState'
import { GrantLock } from '@/components/GrantLock'
import { GrantStatusPill } from '@/components/GrantStatusPill'
import { KpiCard } from '@/components/KpiCard'
import { Loading } from '@/components/Loading'
import { ScheduleCurve } from '@/components/ScheduleCurve'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ArrowLeftIcon, SpinnerIcon } from '@/icons'
import { MilestoneTimeline } from '@/pages/GrantDetail/MilestoneTimeline'
import { deriveGrant, grantBacking, useVesting, useVestingStore } from '@/store/useVestingStore'
import { useNow } from '@/utils/clock'
import { formatDate } from '@/utils/format'
import { copyToast } from '@/utils/toast'

export const GrantDetail = (): React.JSX.Element => {
  const nowMs = useNow()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const { backend, partyId, sessionPending } = useVesting()
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

  // Without this a direct link reads as a missing grant until the first ACS read lands.
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
            <CurvePill curve={grant.schedule.curve} />
            <GrantStatusPill status={derived.status} />
          </div>
        </div>
        <div className="flex gap-2.5">
          {isReceiver &&
            (derived.locked ? (
              <GrantLock className="self-center" />
            ) : (
              <Button disabled={!derived.canClaim} onClick={() => setClaimOpen(true)}>
                Claim <CompactAmount value={derived.claimable} plain /> CC
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
            {claims === undefined ? (
              <div role="status" className="flex h-full items-center justify-center text-fg-muted">
                <SpinnerIcon width={20} height={20} />
                <span className="sr-only">Loading withdraw history</span>
              </div>
            ) : claims.length === 0 ? (
              <p className="text-sm text-fg-muted">No withdrawals yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 pr-1">
                {claims.map((record) => (
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
          onClose={() => setClaimOpen(false)}
          title="Claim vested CC"
          available={derived.claimable}
          backing={grantBacking(grant)}
          onConfirm={async (amount) => {
            // A partial claim archives this contract and re-creates it, so the URL follows the
            // successor. A drain leaves none, and staying here would read "Grant not found".
            const next = await withdraw(backend, partyId, grant.id, amount)
            if (next === undefined) {
              navigate('/', { replace: true })
            } else if (next !== grant.id) {
              navigate(`/grants/${next}`, { replace: true })
            }
          }}
        />
      )}

      {cancelOpen && (
        <CancelGrant
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
