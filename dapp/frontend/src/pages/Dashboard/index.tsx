import { partyHint } from '@bootnodedev/canton-dappbooster'
import { useMemo, useState } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { CancelGrant } from '@/components/CancelGrant'
import { Card } from '@/components/Card'
import { Claim } from '@/components/Claim'
import { CompactAmount } from '@/components/CompactAmount'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { EmptyState } from '@/components/EmptyState'
import { KpiCard } from '@/components/KpiCard'
import { Loading } from '@/components/Loading'
import { PageTitle } from '@/components/PageTitle'
import { RoleSelect } from '@/components/RoleSelect'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRoleLens } from '@/hooks/useRoleLens'
import { PlusIcon } from '@/icons'
import { GrantCard } from '@/pages/Dashboard/GrantCard'
import type { Grant, VestedClaim } from '@/store/types'
import {
  claimAvailable,
  deriveGrant,
  type GrantDerived,
  grantBacking,
  useVesting,
  useVestingStore,
} from '@/store/useVestingStore'
import { addAmounts, isPositive } from '@/utils/amount'
import { now, useNow } from '@/utils/clock'
import { cn } from '@/utils/cn'
import { AMT } from '@/utils/tokens'

interface GrantRow {
  derived: GrantDerived
  grant: Grant
}

// One row per filter, so adding one is a single entry rather than an edit to a union, a label list
// and a branch that had to agree. The two status entries carry their GrantStatus name and the pill's
// own wording, so a row can never sit under a heading its own badge contradicts.
const FILTERS = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'claimable', label: 'Claimable', match: ({ derived }) => isPositive(derived.claimable) },
  { value: 'in_cliff', label: 'In cliff', match: ({ derived }) => derived.status === 'in_cliff' },
  {
    value: 'not_started',
    label: 'Not started',
    match: ({ derived }) => derived.status === 'not_started',
  },
  {
    value: 'linear',
    label: 'Linear',
    match: ({ grant }) => grant.schedule.curve.kind === 'linear',
  },
  {
    value: 'milestone',
    label: 'Milestone',
    match: ({ grant }) => grant.schedule.curve.kind === 'milestone',
  },
] as const satisfies readonly { label: string; match: (row: GrantRow) => boolean; value: string }[]

type Filter = (typeof FILTERS)[number]['value']

// Marks the row a claim just landed on: it moves nothing, so a reader looking elsewhere can still
// find what changed. The keyframes end on the card's own surface and shadow and the fill mode holds
// them, so the class needs no timer to take back off.
const HIGHLIGHT = 'animate-claimed'

interface ClaimTarget {
  available: string
  backing: string
  id: string
  kind: 'grant' | 'claim'
}

export const Dashboard = (): React.JSX.Element => {
  useDocumentTitle('Grants')
  const nowMs = useNow()
  const { backend, partyId, sessionPending } = useVesting()
  const [role, setRole] = useRoleLens()
  const [, setCreating] = useCreateGrant()

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

  const rows = useMemo<GrantRow[]>(() => {
    const mine = grants.filter((g) =>
      role === 'receiver' ? g.receiver === partyId : g.creator === partyId,
    )
    return mine.map((grant) => ({ grant, derived: deriveGrant(grant, nowMs) }))
  }, [grants, role, partyId, nowMs])

  const filtered = useMemo(() => {
    const match = FILTERS.find((entry) => entry.value === filter)?.match
    return match === undefined ? rows : rows.filter(match)
  }, [rows, filter])

  // The sum rides with the list it sums, or it re-reduces on every clock tick for a figure only the
  // receiver lens ever renders.
  const { myClaims, residualClaimable } = useMemo(() => {
    const mine = role === 'receiver' ? claims.filter((c) => c.receiver === partyId) : []
    return {
      myClaims: mine,
      residualClaimable: mine.reduce((sum, c) => addAmounts(sum, claimAvailable(c)), '0'),
    }
  }, [claims, role, partyId])

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
      backing: grantBacking(grant),
    })
  }
  const openResidual = (claim: VestedClaim): void => {
    // A residual claim carries no schedule, so the floor spans the one amount the grant's two do.
    const available = claimAvailable(claim)
    setClaimTarget({ kind: 'claim', id: claim.id, available, backing: available })
  }

  return (
    <div className="flex flex-col gap-7">
      <PageTitle title="Grants" lens={<RoleSelect value={role} onChange={setRole} />} />

      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Filter grants</legend>
          {FILTERS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              aria-pressed={filter === entry.value}
              onClick={() => setFilter(entry.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                filter === entry.value
                  ? 'border-primary bg-primary-soft text-fg'
                  : 'border-border text-fg-muted hover:text-fg',
              )}
            >
              {entry.label}
            </button>
          ))}
        </fieldset>
        <Button size="sm" className="ml-auto pl-3" onClick={() => setCreating(true)}>
          <PlusIcon />
          Create
        </Button>
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
        <EmptyState title={rows.length === 0 ? 'No grants' : 'No grants match this filter'} />
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
                  <CompactAmount value={residualClaimable} /> {AMT.symbol} claimable
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

      {claimTarget !== null && (
        <Claim
          onClose={() => setClaimTarget(null)}
          title={claimTarget.kind === 'grant' ? 'Claim vested AMT' : 'Claim residual'}
          available={claimTarget.available}
          backing={claimTarget.backing}
          onConfirm={onConfirmClaim}
        />
      )}

      {cancelTarget !== null && (
        <CancelGrant
          onClose={() => setCancelTarget(null)}
          grant={cancelTarget}
          nowMs={nowMs}
          description={`Vested-but-unclaimed AMT is set aside as a residual claim for ${partyHint(cancelTarget.receiver)}.`}
          successMessage="Grant cancelled; earned residual set aside for the receiver"
          onConfirm={() => cancel(backend, partyId, cancelTarget.id)}
        />
      )}
    </div>
  )
}
