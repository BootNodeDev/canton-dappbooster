import { useState } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import type { PendingGrant, Role } from '@/store/types'
import { errorText } from '@/utils/errorText'
import { toast } from '@/utils/toast'

interface EndPendingGrantProps {
  onClose: () => void
  onConfirm: () => Promise<void>
  pendingGrant: PendingGrant
  role: Role
}

// The two ways an outstanding grant ends without being accepted, in one component: the ledger
// choices differ only in who exercises them, and neither moves anything. Like CancelGrant it owns
// the submit, toast, error and submitting lifecycle so the page does not.
export const EndPendingGrant = ({
  onClose,
  onConfirm,
  pendingGrant,
  role,
}: EndPendingGrantProps): React.JSX.Element => {
  const [submitting, setSubmitting] = useState(false)
  const funder = role === 'funder'

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    try {
      await onConfirm()
      toast.success(funder ? 'Grant cancelled' : 'Grant declined')
      onClose()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={funder ? 'Cancel grant' : 'Decline grant'}
      description={
        funder
          ? 'The offer is withdrawn and the holding it reserves becomes spendable again. Nothing has vested, so the receiver is owed nothing.'
          : 'The offer is declined for good and cannot be accepted later. Nothing moves: the funder keeps everything the grant reserved.'
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-bg/40 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-fg-muted">
              {funder ? 'Back to your balance' : 'Stays with the funder'}
            </span>
            <AmountDisplay value={pendingGrant.totalAmount} className="font-semibold" />
          </div>
        </div>
        <Button
          className="mt-2 w-full"
          variant="danger"
          size="sm"
          onClick={() => void submit()}
          pending={submitting}
        >
          {funder ? 'Cancel grant' : 'Decline grant'}
        </Button>
      </div>
    </Modal>
  )
}
