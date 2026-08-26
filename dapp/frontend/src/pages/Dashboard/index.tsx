import { partyHint } from '@bootnodedev/canton-dappbooster'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { CancelGrant } from '@/components/CancelGrant'
import { Card } from '@/components/Card'
import { Claim } from '@/components/Claim'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { RoleSelect } from '@/components/RoleSelect'
import { Select } from '@/components/Select'
import { useRoleLens } from '@/hooks/useRoleLens'
import { PlusIcon } from '@/icons'
import { CreateGrant } from '@/pages/Dashboard/CreateGrant'
import { GrantCard } from '@/pages/Dashboard/GrantCard'
import { KpiCard } from '@/pages/Dashboard/KpiCard'
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
import { formatCC } from '@/utils/format'

interface GrantRow {
  derived: GrantDerived
  grant: Grant
}

type Filter = 'all' | 'claimable' | 'not_started' | 'milestone'
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claimable', label: 'Claimable' },
  { value: 'not_started', label: 'Not started' },
  { value: 'milestone', label: 'Milestone' },
]

interface ClaimTarget {
  available: string
  id: string
  kind: 'grant' | 'claim'
}

export const Dashboard = (): React.JSX.Element => {
  const nowMs = useNow()
  const [searchParams, setSearchParams] = useSearchParams()
  const { backend, partyId } = useVesting()
  const [role, setRole] = useRoleLens()
  // Kept in the URL so /create can redirect here and open it, and so closing frees that link to
  // open it again.
  const creating = searchParams.get('create') === '1'
  const setCreating = (on: boolean): void =>
    setSearchParams(
      (params) => {
        if (on) {
          params.set('create', '1')
        } else {
          params.delete('create')
        }
        return params
      },
      { replace: true },
    )

  const grants = useVestingStore((s) => s.grants)
  const claims = useVestingStore((s) => s.claims)
  const withdraw = useVestingStore((s) => s.withdraw)
  const claimResidual = useVestingStore((s) => s.claimResidual)
  const cancel = useVestingStore((s) => s.cancel)

  const [filter, setFilter] = useState<Filter>('all')
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Grant | null>(null)

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
        if (filter === 'not_started') {
          return derived.locked
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

  // Above the handlers, so they close over a backend that is known to exist.
  if (backend === undefined) {
    return (
      <ConnectPrompt description="Your grants, what has vested and what you can claim are read from the ledger as your connected party." />
    )
  }

  const onConfirmClaim = async (amount: string): Promise<void> => {
    if (claimTarget === null) {
      return
    }
    if (claimTarget.kind === 'grant') {
      await withdraw(backend, partyId, claimTarget.id, amount)
    } else {
      await claimResidual(backend, partyId, claimTarget.id, amount)
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
            <KpiCard label="Active grants" amount={String(rows.length)} unit="" />
          </>
        )}
      </div>

      {filtered.length === 0 ? (
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
      ) : (
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
      )}

      {role === 'receiver' && myClaims.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-fg">Residual claims</h2>
            <span className="font-mono text-xs text-fg-muted">
              {isPositive(residualClaimable) ? `${formatCC(residualClaimable)} CC claimable` : ''}
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
