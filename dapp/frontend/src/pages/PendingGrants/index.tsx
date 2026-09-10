import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { PageTitle } from '@/components/PageTitle'
import { RoleSelect } from '@/components/RoleSelect'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRoleLens } from '@/hooks/useRoleLens'
import { EndPendingGrant } from '@/pages/PendingGrants/EndPendingGrant'
import { PendingGrantCard } from '@/pages/PendingGrants/PendingGrantCard'
import type { PendingGrant, Role } from '@/store/types'
import { useVesting, useVestingStore } from '@/store/useVestingStore'
import { useNow } from '@/utils/clock'
import { errorText } from '@/utils/errorText'
import { toast } from '@/utils/toast'

interface Ending {
  partyId: string
  pendingGrant: PendingGrant
  role: Role
}

export const PendingGrants = (): React.JSX.Element => {
  useDocumentTitle('Pending Grants')
  const nowMs = useNow()
  const { backend, partyId, sessionPending } = useVesting()
  const [role, setRole] = useRoleLens()
  const [, setCreating] = useCreateGrant()
  const pendingGrants = useVestingStore((s) => s.pendingGrants)
  const loading = useVestingStore((s) => s.loading)
  const accept = useVestingStore((s) => s.accept)
  // Captured at open, not read live: the role comes from a URL search param and the party from the
  // wallet session, so either can flip under an open dialog (browser Back/Forward, an account
  // change). This is what keeps the dialog's title and its write pinned to the grant it opened on.
  const [ending, setEnding] = useState<Ending | undefined>(undefined)
  // What each grant already has in flight. Tracked by the page rather than by the dialog, which can
  // be dismissed over the wallet prompt and unmount with its submission still out; and covering the
  // accept as well as the two ends, because both exits archive the same proposal, so leaving either
  // live during the other sends a second one the ledger can only reject.
  const [busy, setBusy] = useState<ReadonlyMap<string, 'accept' | 'end'>>(new Map())
  const cancelProposal = useVestingStore((s) => s.cancelProposal)
  const rejectProposal = useVestingStore((s) => s.rejectProposal)

  // Pinning the party is only half of it: the grant belongs to the account that opened the dialog,
  // so an account switch under it would submit as a party the wallet no longer holds. Close it.
  useEffect(() => {
    setEnding((current) => (current?.partyId === partyId ? current : undefined))
  }, [partyId])

  const direction = role === 'receiver' ? 'incoming' : 'outgoing'
  const visible = useMemo<PendingGrant[]>(
    () =>
      pendingGrants.filter((p) =>
        direction === 'incoming' ? p.receiver === partyId : p.proposer === partyId,
      ),
    [pendingGrants, direction, partyId],
  )

  // Above the handler, so it closes over a backend that is known to exist.
  if (backend === undefined) {
    return sessionPending ? <Loading /> : <ConnectPrompt />
  }

  const whileBusy = async (
    pendingCid: string,
    kind: 'accept' | 'end',
    run: () => Promise<void>,
  ): Promise<void> => {
    setBusy((current) => new Map(current).set(pendingCid, kind))
    try {
      await run()
    } finally {
      setBusy((current) => {
        const next = new Map(current)
        next.delete(pendingCid)
        return next
      })
    }
  }

  // The accept owns its own toasts, where the two ends leave theirs to the dialog that confirmed
  // them: this is the only one reached from the card itself.
  const onAccept = (pendingGrant: PendingGrant): Promise<void> =>
    whileBusy(pendingGrant.id, 'accept', async () => {
      try {
        await accept(backend, partyId, pendingGrant.id)
        toast.success('Grant accepted and active')
      } catch (err) {
        toast.error(errorText(err))
      }
    })

  const endGrant = (target: Ending): Promise<void> =>
    whileBusy(target.pendingGrant.id, 'end', () =>
      target.role === 'funder'
        ? cancelProposal(backend, target.partyId, target.pendingGrant.id)
        : rejectProposal(backend, target.partyId, target.pendingGrant.id),
    )

  return (
    <div className="flex flex-col gap-7">
      <PageTitle title="Pending Grants" lens={<RoleSelect value={role} onChange={setRole} />} />

      {loading && pendingGrants.length === 0 ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No pending grants"
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
          {visible.map((pendingGrant) => (
            <PendingGrantCard
              key={pendingGrant.id}
              pendingGrant={pendingGrant}
              direction={direction}
              nowMs={nowMs}
              onAccept={(p) => void onAccept(p)}
              onEnd={(p) => setEnding({ pendingGrant: p, role, partyId })}
              busy={busy.get(pendingGrant.id)}
            />
          ))}
        </div>
      )}

      {ending !== undefined && (
        <EndPendingGrant
          onClose={() => setEnding(undefined)}
          pendingGrant={ending.pendingGrant}
          role={ending.role}
          onConfirm={() => endGrant(ending)}
        />
      )}
    </div>
  )
}
