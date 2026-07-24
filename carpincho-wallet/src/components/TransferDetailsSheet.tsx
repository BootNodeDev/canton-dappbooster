import type { PendingTokenTransfer } from '@/cip56/transfers'
import { transferStatusLabel, transferTimeLabel } from '@/cip56/transfers'
import { DetailRow } from '@/components/ui/DetailRow'
import { Sheet } from '@/components/ui/Sheet'

interface TransferDetailsSheetProps {
  transfer: PendingTokenTransfer | null
  onClose: () => void
}

// Full transfer metadata in the app's standard Sheet, opened from a transfer's eye button.
export const TransferDetailsSheet = ({
  transfer,
  onClose,
}: TransferDetailsSheetProps): JSX.Element => {
  const view = transfer?.interfaceViewValue?.transfer
  return (
    <Sheet
      open={transfer !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      testId="transfer-details-sheet"
      side="center"
      title="Transfer details"
      description="Full details for this transfer instruction."
    >
      {transfer === null ? null : (
        <dl className="grid gap-3">
          <DetailRow
            label="status"
            value={transferStatusLabel(transfer)}
          />
          <DetailRow
            label="requested"
            value={transferTimeLabel(view?.requestedAt)}
          />
          <DetailRow
            label="expires"
            value={transferTimeLabel(view?.executeBefore)}
          />
          <DetailRow
            label="sender"
            value={view?.sender ?? 'unknown'}
            copyLabel="sender"
          />
          <DetailRow
            label="receiver"
            value={view?.receiver ?? 'unknown'}
            copyLabel="receiver"
          />
          <DetailRow
            label="contract id"
            value={transfer.contractId}
            copyLabel="contract ID"
          />
        </dl>
      )}
    </Sheet>
  )
}
