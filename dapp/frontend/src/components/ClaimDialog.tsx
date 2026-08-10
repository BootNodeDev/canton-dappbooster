import { TokenInput, validateAmount } from '@bootnodedev/canton-dappbooster'
import { useEffect, useRef, useState } from 'react'
import { useToken } from '@/hooks/useToken'
import { isPositive } from '@/lib/amount'
import { AMOUNT_ERROR_TEXT } from '@/lib/amountErrorText'
import { errorText } from '@/lib/errorText'
import { formatCC, formatCCFull } from '@/lib/format'
import { MIN_GRANT_AMOUNT, meetsRelockFloor } from '@/lib/schedule'
import { Button } from './Button'
import { FieldError } from './FieldError'
import { Modal } from './Modal'
import { toast } from './toast'

interface ClaimDialogProps {
  open: boolean
  onClose: () => void
  title: string
  available: string
  // Submits the ledger command; the dialog awaits it and closes on success.
  onConfirm: (amount: string) => Promise<void>
}

// Amount-entry dialog shared by grant withdraw and residual claim. Enforces the
// re-lock floor: the remainder must be 0 or >= min. No mock signing — onConfirm is
// the real ledger submit.
export const ClaimDialog = ({
  open,
  onClose,
  title,
  available,
  onConfirm,
}: ClaimDialogProps): React.JSX.Element => {
  const token = useToken()
  const [raw, setRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Seed the max only on the open transition. `available` recomputes each second for
  // a live-vesting grant, so re-seeding on its change would overwrite what the user types.
  const seeded = useRef(false)
  useEffect(() => {
    if (open && !seeded.current) {
      seeded.current = true
      setRaw(available)
    } else if (!open) {
      seeded.current = false
    }
  }, [open, available])

  // Recomputed from `available` rather than stored from the last keystroke: it drops each second
  // for a live-vesting grant, so a stored code would keep flagging an amount the field itself has
  // already accepted (and vice versa) until the user typed again. Same bounds the field uses.
  const amountError = validateAmount(raw, { max: available })
  const floorOk = meetsRelockFloor(available, raw)
  // The kit's error wins when both apply, so the two sentences are never shown at once.
  const message =
    amountError !== undefined
      ? AMOUNT_ERROR_TEXT[amountError]
      : !floorOk && isPositive(raw)
        ? `Remainder must be 0 or at least ${MIN_GRANT_AMOUNT} CC (re-lock floor).`
        : undefined

  const valid = amountError === undefined && isPositive(raw) && floorOk

  const submit = async (): Promise<void> => {
    if (!valid) {
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(raw)
      toast.success(`Claimed ${formatCC(raw)} CC`)
      onClose()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={`Available to claim: ${formatCCFull(available)} CC`}
    >
      <TokenInput
        aria-describedby={message === undefined ? undefined : 'claim-amount-error'}
        balance={available}
        id="claim-amount"
        label="Amount"
        onChange={(next) => setRaw(next)}
        token={token}
        value={raw}
      />
      {message !== undefined && (
        <FieldError id="claim-amount-error" message={message} className="mt-2" />
      )}
      <div className="mt-6 flex justify-end gap-2.5">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={!valid || submitting}>
          {submitting ? 'Submitting…' : 'Claim'}
        </Button>
      </div>
    </Modal>
  )
}
