import { useEffect, useMemo, useRef, useState } from 'react'
import type { PendingTokenTransfer } from '@/cip56/transfers'
import { transferDirection } from '@/cip56/transfers'
import { ActivityList } from '@/components/ActivityList'
import { TransferCard } from '@/components/TransferCard'
import { TransferDetailsSheet } from '@/components/TransferDetailsSheet'
import { LoadingState } from '@/components/ui/LoadingState'
import { SECTION_LABEL_CLASS } from '@/components/ui/SectionLabel'
import { toast } from '@/components/ui/toast'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import { usePendingCip56Transfers } from '@/hooks/usePendingCip56Transfers'
import { cn } from '@/utils/cn'
import type { AccountPublic, TransactionRecord } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface ActivityPanelProps {
  account?: AccountPublic
  transactions: TransactionRecord[]
  api?: Cip56TransferApi
  onPendingCountChange?: (count: number) => void
}

// Activity tab body: actionable + in-flight transfers pinned above the settled history feed.
export const ActivityPanel = ({
  account,
  transactions,
  api,
  onPendingCountChange,
}: ActivityPanelProps): JSX.Element => {
  const vault = useVault()
  const activeAccount = account ?? vault.primary ?? vault.accounts[0]
  const [acceptingCid, setAcceptingCid] = useState<string | undefined>(undefined)
  const [detailsTransfer, setDetailsTransfer] = useState<PendingTokenTransfer | null>(null)
  const { transfers, loading, error, accept } = usePendingCip56Transfers(activeAccount, {
    api,
    signMessage: vault.signMessage,
    recordTransaction: vault.recordTransaction,
  })

  const { incoming, outgoing } = useMemo(() => {
    const partyId = activeAccount?.partyId
    const incomingTransfers: PendingTokenTransfer[] = []
    const outgoingTransfers: PendingTokenTransfer[] = []
    for (const transfer of transfers) {
      if (transferDirection(transfer, partyId) === 'outgoing') {
        outgoingTransfers.push(transfer)
      } else {
        incomingTransfers.push(transfer)
      }
    }
    return { incoming: incomingTransfers, outgoing: outgoingTransfers }
  }, [transfers, activeAccount?.partyId])

  // Hold the latest callback in a ref so the count effects don't depend on its identity;
  // a parent that re-creates the callback must not trigger a spurious reset mid-session.
  const onPendingCountChangeRef = useRef(onPendingCountChange)
  useEffect(() => {
    onPendingCountChangeRef.current = onPendingCountChange
  }, [onPendingCountChange])

  // Only incoming transfers need receiver action, so the badge counts those alone.
  useEffect(() => {
    onPendingCountChangeRef.current?.(incoming.length)
  }, [incoming.length])

  // Reset the parent's count when this panel unmounts (e.g. account teardown).
  useEffect(() => {
    return () => onPendingCountChangeRef.current?.(0)
  }, [])

  if (activeAccount === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No account selected</p>
      </div>
    )
  }

  // Optimistically hides the accepted transfer while it settles; a progress toast tracks the
  // flow and is replaced by the result. On failure the transfer reappears so it can be retried.
  const onAccept = async (transferInstructionCid: string): Promise<void> => {
    setAcceptingCid(transferInstructionCid)
    const pendingToastId = toast.info('Accepting transfer...')
    try {
      await accept(transferInstructionCid)
      toast.dismiss(pendingToastId)
      toast.success('Transfer accepted.')
    } catch (err) {
      toast.dismiss(pendingToastId)
      toast.error(`Accept failed: ${(err as Error).message}`)
    } finally {
      setAcceptingCid(undefined)
    }
  }

  // Hide the in-flight transfer from the actionable list as soon as Accept is clicked.
  const visibleIncoming = incoming.filter((transfer) => transfer.contractId !== acceptingCid)
  const hasPending = incoming.length > 0 || outgoing.length > 0
  const showLoading = loading && !hasPending && transactions.length === 0
  // ActivityList owns the "No activity yet" empty state, so render it only when there is real
  // history or nothing is pending; otherwise that text reads as empty beneath the pending cards.
  const showHistory = !showLoading && (transactions.length > 0 || !hasPending)

  return (
    <div className="flex min-h-full flex-col gap-3 px-1 pt-3 pb-2">
      {error === undefined ? null : (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {error}
        </div>
      )}

      {visibleIncoming.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className={cn('m-0', SECTION_LABEL_CLASS)}>Needs action</h2>
          {visibleIncoming.map((transfer) => (
            <TransferCard
              key={transfer.contractId}
              transfer={transfer}
              direction="incoming"
              onAccept={onAccept}
              onOpenDetails={setDetailsTransfer}
            />
          ))}
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className={cn('m-0', SECTION_LABEL_CLASS)}>Awaiting acceptance</h2>
          {outgoing.map((transfer) => (
            <TransferCard
              key={transfer.contractId}
              transfer={transfer}
              direction="outgoing"
              onOpenDetails={setDetailsTransfer}
            />
          ))}
        </section>
      ) : null}

      {showLoading ? <LoadingState label="Loading transfers" /> : null}
      {showHistory ? <ActivityList transactions={transactions} /> : null}

      <TransferDetailsSheet
        transfer={detailsTransfer}
        onClose={() => setDetailsTransfer(null)}
      />
    </div>
  )
}
