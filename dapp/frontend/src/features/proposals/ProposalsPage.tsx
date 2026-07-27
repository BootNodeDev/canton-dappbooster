import { useMemo } from 'react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { PrivacyNote } from '@/components/PrivacyNote'
import { ProposalCard } from '@/components/ProposalCard'
import { toast } from '@/components/toast'
import { useNow } from '@/lib/clock'
import type { Proposal } from '@/store/types'
import { useUiStore } from '@/store/useUiStore'
import { useVesting, useVestingStore } from '@/store/useVestingStore'

export const ProposalsPage = (): React.JSX.Element => {
  const nowMs = useNow()
  const { backend, partyId } = useVesting()
  const role = useUiStore((s) => s.role)
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

  const onAccept = async (proposal: Proposal): Promise<void> => {
    try {
      await accept(backend, partyId, proposal.id)
      toast.success('Proposal accepted, grant active')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (visible.length === 0) {
    return (
      <>
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
        <PrivacyNote />
      </>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
  )
}
