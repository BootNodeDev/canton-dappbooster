import { useMemo } from 'react'
import { Button } from '@/components/Button'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { RoleSelect } from '@/components/RoleSelect'
import { useRoleLens } from '@/hooks/useRoleLens'
import { ProposalCard } from '@/pages/Proposals/ProposalCard'
import type { Proposal } from '@/store/types'
import { useVesting, useVestingStore } from '@/store/useVestingStore'
import { useNow } from '@/utils/clock'
import { errorText } from '@/utils/errorText'
import { toast } from '@/utils/toast'

export const Proposals = (): React.JSX.Element => {
  const nowMs = useNow()
  const { backend, partyId } = useVesting()
  const [role, setRole] = useRoleLens()
  const proposals = useVestingStore((s) => s.proposals)
  const accept = useVestingStore((s) => s.accept)

  const direction = role === 'receiver' ? 'incoming' : 'outgoing'
  const visible = useMemo<Proposal[]>(
    () =>
      proposals.filter((p) =>
        direction === 'incoming' ? p.receiver === partyId : p.proposer === partyId,
      ),
    [proposals, direction, partyId],
  )

  // Above the handler, so it closes over a backend that is known to exist.
  if (backend === undefined) {
    return (
      <ConnectPrompt description="Proposals sent to you, and the ones you have sent, are read from the ledger as your connected party." />
    )
  }

  const onAccept = async (proposal: Proposal): Promise<void> => {
    try {
      await accept(backend, partyId, proposal.id)
      toast.success('Proposal accepted, grant active')
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageTitle title="Proposals" />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <RoleSelect value={role} onChange={setRole} />
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title={direction === 'incoming' ? 'No pending proposals' : 'No outstanding offers'}
          description={
            direction === 'incoming'
              ? 'Grant proposals sent to you will appear here to accept.'
              : 'Grants you propose to others appear here until they are accepted.'
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
          {visible.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              direction={direction}
              nowMs={nowMs}
              onAccept={(p) => void onAccept(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
