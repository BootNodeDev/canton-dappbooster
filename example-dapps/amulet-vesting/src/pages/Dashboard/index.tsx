import { partyHint } from '@bootnodedev/canton-dappbooster'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { CancelGrant } from '@/components/CancelGrant'
import { Claim } from '@/components/Claim'
import { CompactAmount } from '@/components/CompactAmount'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { EmptyState } from '@/components/EmptyState'
import { GrantRow } from '@/components/GrantRow'
import { Loading } from '@/components/Loading'
import { PageTitle } from '@/components/PageTitle'
import { Pills } from '@/components/Pills'
import { RoleSelect } from '@/components/RoleSelect'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRoleLens } from '@/hooks/useRoleLens'
import { GrantCard } from '@/pages/Dashboard/GrantCard'
import { Summary, type Totals } from '@/pages/Dashboard/Summary'
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

interface Row {
  derived: GrantDerived
  grant: Grant
}

const FILTERS = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'claimable', label: 'Claimable', match: ({ derived }) => derived.canClaim },
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
] as const satisfies readonly { label: string; match: (row: Row) => boolean; value: string }[]

type Filter = (typeof FILTERS)[number]['value']

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

  const rows = useMemo<Row[]>(() => {
    const mine = grants.filter((g) =>
      role === 'receiver' ? g.receiver === partyId : g.creator === partyId,
    )
    return mine.map((grant) => ({ grant, derived: deriveGrant(grant, nowMs) }))
  }, [grants, role, partyId, nowMs])

  const filtered = useMemo(() => {
    const match = FILTERS.find((entry) => entry.value === filter)?.match
    return match === undefined ? rows : rows.filter(match)
  }, [rows, filter])

  const { myClaims, residualClaimable } = useMemo(() => {
    const mine = role === 'receiver' ? claims.filter((c) => c.receiver === partyId) : []
    return {
      myClaims: mine,
      residualClaimable: mine.reduce((sum, c) => addAmounts(sum, claimAvailable(c)), '0'),
    }
  }, [claims, role, partyId])

  const totals = useMemo(() => {
    const acc: Totals = { total: '0', vested: '0', claimable: '0', claimed: '0', unvested: '0' }
    for (const { grant, derived } of rows) {
      acc.total = addAmounts(acc.total, grant.totalAmount)
      acc.vested = addAmounts(acc.vested, derived.vested)
      acc.claimable = addAmounts(acc.claimable, derived.claimable)
      acc.claimed = addAmounts(acc.claimed, derived.claimed)
      acc.unvested = addAmounts(acc.unvested, derived.unvested)
    }
    return acc
  }, [rows])

  const firstRead = loading && grants.length === 0
  const filters = FILTERS.map((entry) => ({ ...entry, count: rows.filter(entry.match).length }))
  const claimableCount = filters.find((entry) => entry.value === 'claimable')?.count ?? 0

  if (backend === undefined) {
    return sessionPending ? <Loading /> : <ConnectPrompt />
  }

  const onConfirmClaim = async (amount: string): Promise<void> => {
    if (claimTarget === null) {
      return
    }
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
    const available = claimAvailable(claim)
    setClaimTarget({ kind: 'claim', id: claim.id, available, backing: available })
  }

  return (
    <div className="flex flex-col gap-8">
      <PageTitle
        title="Grants"
        description={
          role === 'receiver'
            ? 'Canton Coin that vests to your party. Claim it as it vests.'
            : 'Grants you funded, and what is still to vest.'
        }
        action={
          <>
            <RoleSelect value={role} onChange={setRole} />
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Create grant
            </Button>
          </>
        }
      />

      <Summary
        claimableCount={claimableCount}
        grantCount={rows.length}
        role={role}
        totals={totals}
      />

      <div className="flex flex-col gap-3.5">
        <Pills
          className="max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4"
          label="Filter grants"
          onChange={setFilter}
          options={filters}
          value={filter}
        />
        {firstRead ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState title={rows.length === 0 ? 'No grants' : 'No grants match this filter'} />
        ) : (
          <div className="flex flex-col gap-2.5">
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
      </div>

      {role === 'receiver' && myClaims.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-fg">Residual claims</h2>
            <span className="font-num text-xs text-fg-muted">
              {isPositive(residualClaimable) && (
                <>
                  <CompactAmount value={residualClaimable} /> {AMT.symbol} claimable
                </>
              )}
            </span>
          </div>
          {myClaims.map((claim) => (
            <GrantRow
              key={claim.id}
              className={cn(claim.id === justClaimed && HIGHLIGHT)}
              title={claim.title}
              detail={<span className="text-sm text-fg-muted">{claim.note}</span>}
              figure={{ label: 'Claimable', amount: claimAvailable(claim) }}
              action={
                <Button size="sm" onClick={() => openResidual(claim)}>
                  Claim
                </Button>
              }
            />
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
