import { useMemo, useState } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ClaimDialog } from '@/components/ClaimDialog'
import { EmptyState } from '@/components/EmptyState'
import { GrantCard } from '@/components/GrantCard'
import { type GrantRow, GrantTable } from '@/components/GrantTable'
import { KpiCard } from '@/components/KpiCard'
import { Modal } from '@/components/Modal'
import { PrivacyNote } from '@/components/PrivacyNote'
import { toast } from '@/components/toast'
import { now, useNow } from '@/lib/clock'
import { cn } from '@/lib/cn'
import type { Grant, VestedClaim } from '@/store/types'
import { useUiStore } from '@/store/useUiStore'
import { deriveGrant, useVesting, useVestingStore } from '@/store/useVestingStore'

type Filter = 'all' | 'claimable' | 'cliff' | 'milestone'
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claimable', label: 'Claimable' },
  { value: 'cliff', label: 'In cliff' },
  { value: 'milestone', label: 'Milestone' },
]

interface ClaimTarget {
  kind: 'grant' | 'claim'
  id: string
  available: number
}

export const DashboardPage = (): React.JSX.Element => {
  const nowMs = useNow()
  const { backend, partyId } = useVesting()
  const role = useUiStore((s) => s.role)
  const view = useUiStore((s) => s.dashboardView)
  const setView = useUiStore((s) => s.setDashboardView)

  const grants = useVestingStore((s) => s.grants)
  const claims = useVestingStore((s) => s.claims)
  const withdraw = useVestingStore((s) => s.withdraw)
  const claimResidual = useVestingStore((s) => s.claimResidual)
  const cancel = useVestingStore((s) => s.cancel)

  const [filter, setFilter] = useState<Filter>('all')
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Grant | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const rows = useMemo<GrantRow[]>(() => {
    const mine = grants.filter((g) =>
      role === 'receiver' ? g.receiver === partyId : g.creator === partyId,
    )
    return mine.map((grant) => ({ grant, derived: deriveGrant(grant, nowMs) }))
  }, [grants, role, partyId, nowMs])

  const filtered = useMemo(
    () =>
      rows.filter(({ grant, derived }) => {
        if (filter === 'claimable') {
          return derived.claimable > 0
        }
        if (filter === 'cliff') {
          return derived.status === 'in_cliff'
        }
        if (filter === 'milestone') {
          return grant.schedule.curve.kind === 'milestone'
        }
        return true
      }),
    [rows, filter],
  )

  const myClaims = useMemo(
    () => (role === 'receiver' ? claims.filter((c) => c.receiver === partyId) : []),
    [claims, role, partyId],
  )

  const totals = useMemo(() => {
    const acc = { total: 0, vested: 0, claimable: 0, claimed: 0, unvested: 0 }
    for (const { grant, derived } of rows) {
      acc.total += grant.totalAmount
      acc.vested += derived.vested
      acc.claimable += derived.claimable
      acc.claimed += derived.claimed
      acc.unvested += derived.unvested
    }
    return acc
  }, [rows])

  const residualClaimable = myClaims.reduce((sum, c) => sum + (c.amount - c.withdrawn), 0)
  const isEmpty = rows.length === 0 && myClaims.length === 0

  const onConfirmClaim = async (amount: number): Promise<void> => {
    if (claimTarget === null) {
      return
    }
    if (claimTarget.kind === 'grant') {
      await withdraw(backend, partyId, claimTarget.id, amount)
    } else {
      await claimResidual(backend, partyId, claimTarget.id, amount)
    }
  }

  const onConfirmCancel = async (): Promise<void> => {
    if (cancelTarget === null) {
      return
    }
    setCancelling(true)
    try {
      await cancel(backend, partyId, cancelTarget.id)
      toast.success('Grant cancelled; earned residual set aside for the receiver')
      setCancelTarget(null)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  const openClaim = (grant: Grant): void => {
    const derived = deriveGrant(grant, now())
    setClaimTarget({
      kind: 'grant',
      id: grant.id,
      available: derived.claimable,
    })
  }
  const openResidual = (claim: VestedClaim): void => {
    setClaimTarget({
      kind: 'claim',
      id: claim.id,
      available: claim.amount - claim.withdrawn,
    })
  }

  return (
    <div className="flex flex-col gap-7">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {role === 'receiver' ? (
          <>
            <KpiCard
              hero
              label="Claimable now"
              amount={totals.claimable}
              sub={`Across ${rows.length} grants`}
              subTone="success"
            />
            <KpiCard label="Total granted" amount={totals.total} sub={`${rows.length} active`} />
            <KpiCard label="Vested to date" amount={totals.vested} />
            <KpiCard label="Already claimed" amount={totals.claimed} />
          </>
        ) : (
          <>
            <KpiCard
              hero
              label="Total committed"
              amount={totals.total}
              sub={`${rows.length} grants funded`}
            />
            <KpiCard label="Vested to date" amount={totals.vested} />
            <KpiCard label="Unvested (clawbackable)" amount={totals.unvested} />
            <KpiCard label="Active grants" amount={rows.length} unit="" />
          </>
        )}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f.value
                  ? 'border-accent bg-accent/12 text-accent'
                  : 'border-border bg-surface text-fg-muted hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface p-1">
          {(['cards', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-bold capitalize transition-colors',
                view === v ? 'bg-primary-soft text-fg' : 'text-fg-muted hover:text-fg',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* grants */}
      {filtered.length === 0 ? (
        <>
          <EmptyState
            title="No grants here"
            description={
              role === 'receiver'
                ? 'No grants match this filter. Accepted proposals appear here.'
                : 'You have not funded any grants matching this filter yet.'
            }
            action={
              role === 'funder' ? (
                <Button asLink to="/create" size="sm">
                  Create a grant
                </Button>
              ) : undefined
            }
          />
          {isEmpty && <PrivacyNote />}
        </>
      ) : view === 'cards' ? (
        <div className="flex flex-col gap-4">
          {filtered.map(({ grant, derived }) => (
            <GrantCard
              key={grant.id}
              grant={grant}
              derived={derived}
              role={role}
              nowMs={nowMs}
              onClaim={openClaim}
              onCancel={setCancelTarget}
            />
          ))}
        </div>
      ) : (
        <GrantTable rows={filtered} role={role} onClaim={openClaim} onCancel={setCancelTarget} />
      )}

      {/* residual claims (receiver) */}
      {role === 'receiver' && myClaims.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-fg">Residual claims</h2>
            <span className="font-mono text-xs text-fg-muted">
              {residualClaimable > 0 ? `${residualClaimable.toLocaleString()} CC claimable` : ''}
            </span>
          </div>
          {myClaims.map((claim) => (
            <Card key={claim.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <div className="text-base font-bold text-fg">{claim.title}</div>
                <p className="mt-1 text-sm text-fg-muted">{claim.note}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
                    Claimable
                  </div>
                  <AmountDisplay
                    value={claim.amount - claim.withdrawn}
                    className="text-lg font-semibold text-success"
                  />
                </div>
                <Button size="sm" onClick={() => openResidual(claim)}>
                  Claim
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {claimTarget !== null && (
        <ClaimDialog
          open
          onClose={() => setClaimTarget(null)}
          title={claimTarget.kind === 'grant' ? 'Claim vested CC' : 'Claim residual'}
          available={claimTarget.available}
          onConfirm={onConfirmClaim}
        />
      )}

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel grant"
        description={
          cancelTarget === null
            ? ''
            : `Vested-but-unclaimed CC is set aside as a residual claim for ${cancelTarget.receiver.split('::')[0]}.`
        }
      >
        {cancelTarget !== null && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-bg/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-fg-muted">Returned to you</span>
                <AmountDisplay
                  value={deriveGrant(cancelTarget, nowMs).unvested}
                  className="font-semibold"
                />
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="text-fg-muted">Residual to receiver</span>
                <AmountDisplay
                  value={deriveGrant(cancelTarget, nowMs).claimable}
                  className="font-semibold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                Keep grant
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void onConfirmCancel()}
                disabled={cancelling}
              >
                {cancelling ? 'Submitting…' : 'Cancel grant'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
