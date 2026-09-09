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
  const [ending, setEnding] = useState<
    { pendingGrant: PendingGrant; role: Role; partyId: string } | undefined
  >(undefined)
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

  const onAccept = async (pendingGrant: PendingGrant): Promise<void> => {
    try {
      await accept(backend, partyId, pendingGrant.id)
      toast.success('Grant accepted and active')
    } catch (err) {
      toast.error(errorText(err))
    }
  }

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
            />
          ))}
        </div>
      )}

      {ending !== undefined && (
        <EndPendingGrant
          onClose={() => setEnding(undefined)}
          pendingGrant={ending.pendingGrant}
          role={ending.role}
          onConfirm={() =>
            ending.role === 'funder'
              ? cancelProposal(backend, ending.partyId, ending.pendingGrant.id)
              : rejectProposal(backend, ending.partyId, ending.pendingGrant.id)
          }
        />
      )}
    </div>
  )
}
