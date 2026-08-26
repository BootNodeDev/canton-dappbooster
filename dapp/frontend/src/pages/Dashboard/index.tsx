import { partyHint } from '@bootnodedev/canton-dappbooster'
import { useEffect, useMemo, useState } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { CancelGrant } from '@/components/CancelGrant'
import { Card } from '@/components/Card'
import { Claim } from '@/components/Claim'
import { CompactAmount } from '@/components/CompactAmount'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { CreateGrant } from '@/components/CreateGrant'
import { EmptyState } from '@/components/EmptyState'
import { KpiCard } from '@/components/KpiCard'
import { Loading } from '@/components/Loading'
import { PageTitle } from '@/components/PageTitle'
import { RoleSelect } from '@/components/RoleSelect'
import { Select } from '@/components/Select'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { useRoleLens } from '@/hooks/useRoleLens'
import { PlusIcon } from '@/icons'
import { GrantCard } from '@/pages/Dashboard/GrantCard'
import { useBackend } from '@/providers/Backend'
import type { Grant, VestedClaim } from '@/store/types'
import {
  claimAvailable,
  deriveGrant,
  type GrantDerived,
  useVesting,
  useVestingStore,
} from '@/store/useVestingStore'
import { addAmounts, isPositive } from '@/utils/amount'
import { now, useNow } from '@/utils/clock'
import { cn } from '@/utils/cn'
import { CC } from '@/utils/tokens'

interface GrantRow {
  derived: GrantDerived
  grant: Grant
}

// The two status entries carry their GrantStatus name and the pill's own wording, so a row can
// never sit under a heading its own badge contradicts.
type Filter =
  | 'all'
  | 'claimable'
  | 'fully_claimed'
  | 'in_cliff'
  | 'not_started'
  | 'linear'
  | 'milestone'
const filters: { label: string; value: Filter }[] = [
  { value: 'all', label: 'All' },
  { value: 'claimable', label: 'Claimable' },
  { value: 'fully_claimed', label: 'Fully claimed' },
  { value: 'in_cliff', label: 'In cliff' },
  { value: 'not_started', label: 'Not started' },
  { value: 'linear', label: 'Linear' },
  { value: 'milestone', label: 'Milestone' },
]

// Marks the row a claim just landed on: it moves nothing, so a reader looking elsewhere can still
// find what changed. The keyframes hold, then fade back to the card's own surface and shadow.
const HIGHLIGHT = 'animate-claimed'
const HIGHLIGHT_MS = 5000

interface ClaimTarget {
  available: string
  id: string
  kind: 'grant' | 'claim'
}

export const Dashboard = (): React.JSX.Element => {
  const nowMs = useNow()
  const { backend, partyId } = useVesting()
  const { sessionPending } = useBackend()
  const [role, setRole] = useRoleLens()
  const [creating, setCreating] = useCreateGrant()

  const grants = useVestingStore((s) => s.grants)
  const claims = useVestingStore((s) => s.claims)
  const loading = useVestingStore((s) => s.loading)
  const withdraw = useVestingStore((s) => s.withdraw)
  const claimResidual = useVestingStore((s) => s.claimResidual)
  const cancel = useVestingStore((s) => s.cancel)

  const [filter, setFilter] = useState<Filter>('all')
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Grant | null>(null)
  const [justClaimed, setJustClaimed] = useState<string | null>(null)

  useEffect(() => {
    if (justClaimed === null) {
      return
    }
    const timer = setTimeout(() => setJustClaimed(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [justClaimed])

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
          return isPositive(derived.claimable)
        }
        if (filter === 'fully_claimed') {
          return derived.fullyClaimed
        }
        if (filter === 'in_cliff' || filter === 'not_started') {
          return derived.status === filter
        }
        if (filter === 'linear' || filter === 'milestone') {
          return grant.schedule.curve.kind === filter
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
    const acc = { total: '0', vested: '0', claimable: '0', claimed: '0', unvested: '0' }
    for (const { grant, derived } of rows) {
      acc.total = addAmounts(acc.total, grant.totalAmount)
      acc.vested = addAmounts(acc.vested, derived.vested)
      acc.claimable = addAmounts(acc.claimable, derived.claimable)
      acc.claimed = addAmounts(acc.claimed, derived.claimed)
      acc.unvested = addAmounts(acc.unvested, derived.unvested)
    }
    return acc
  }, [rows])

  const residualClaimable = myClaims.reduce((sum, c) => addAmounts(sum, claimAvailable(c)), '0')
  // A refresh after a write keeps the rows on screen; only a read with nothing to show waits.
  const firstRead = loading && grants.length === 0

  // Above the handlers, so they close over a backend that is known to exist.
  if (backend === undefined) {
    return sessionPending ? <Loading /> : <ConnectPrompt />
  }

  const onConfirmClaim = async (amount: string): Promise<void> => {
    if (claimTarget === null) {
      return
    }
    // The claim replaces the contract, so the successor's id is what identifies the row to flag.
    const successor =
      claimTarget.kind === 'grant'
        ? await withdraw(backend, partyId, claimTarget.id, amount)
        : await claimResidual(backend, partyId, claimTarget.id, amount)
    setJustClaimed(successor ?? null)
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
    setClaimTarget({ kind: 'claim', id: claim.id, available: claimAvailable(claim) })
  }

  return (
    <div className="flex flex-col gap-7">
      <PageTitle
        title="Grants"
        action={
          <Button size="sm" className="pl-3" onClick={() => setCreating(true)}>
            <PlusIcon />
            Create
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <RoleSelect value={role} onChange={setRole} />
        <Select label="Filter grants" value={filter} options={filters} onChange={setFilter} />
      </div>

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
            <KpiCard label="Active grants" amount={String(rows.length)} count />
          </>
        )}
      </div>

      {firstRead ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No grants here"
          description={
            role === 'receiver'
              ? 'No grants match this filter. Accepted proposals appear here.'
              : 'You have not funded any grants matching this filter yet.'
          }
          action={
            role === 'funder' ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                Create a grant
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(({ grant, derived }) => (
            <GrantCard
              key={grant.id}
              grant={grant}
              derived={derived}
              role={role}
              nowMs={nowMs}
              className={cn(grant.id === justClaimed && HIGHLIGHT)}
              onClaim={openClaim}
              onCancel={setCancelTarget}
            />
          ))}
        </div>
      )}

      {role === 'receiver' && myClaims.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-fg">Residual claims</h2>
            <span className="font-mono text-xs text-fg-muted">
              {isPositive(residualClaimable) && (
                <>
                  <CompactAmount value={residualClaimable} /> {CC.symbol} claimable
                </>
              )}
            </span>
          </div>
          {myClaims.map((claim) => (
            <Card
              key={claim.id}
              className={cn(
                'flex items-center justify-between gap-4 p-5',
                claim.id === justClaimed && HIGHLIGHT,
              )}
            >
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
                    value={claimAvailable(claim)}
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

      {creating && <CreateGrant open onClose={() => setCreating(false)} />}

      {claimTarget !== null && (
        <Claim
          open
          onClose={() => setClaimTarget(null)}
          title={claimTarget.kind === 'grant' ? 'Claim vested CC' : 'Claim residual'}
          available={claimTarget.available}
          onConfirm={onConfirmClaim}
        />
      )}

      {cancelTarget !== null && (
        <CancelGrant
          open
          onClose={() => setCancelTarget(null)}
          grant={cancelTarget}
          nowMs={nowMs}
          description={`Vested-but-unclaimed CC is set aside as a residual claim for ${partyHint(cancelTarget.receiver)}.`}
          successMessage="Grant cancelled; earned residual set aside for the receiver"
          onConfirm={() => cancel(backend, partyId, cancelTarget.id)}
        />
      )}
    </div>
  )
}
