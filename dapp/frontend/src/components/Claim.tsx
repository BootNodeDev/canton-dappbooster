import { TokenInput, validateAmount } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { FieldError } from '@/components/FieldError'
import { Modal } from '@/components/Modal'
import { SpinnerIcon } from '@/icons'
import { isPositive } from '@/utils/amount'
import { AMOUNT_ERROR_TEXT } from '@/utils/amountErrorText'
import { errorText } from '@/utils/errorText'
import { formatCCFull } from '@/utils/format'
import { MIN_GRANT_AMOUNT, meetsRelockFloor } from '@/utils/schedule'
import { toast } from '@/utils/toast'
import { CC } from '@/utils/tokens'

interface ClaimProps {
  available: string
  onClose: () => void
  onConfirm: (amount: string) => Promise<void>
  open: boolean
  title: string
}

// Amount-entry dialog shared by grant withdraw and residual claim. Enforces the re-lock floor: the
// remainder must be zero or at least MIN_GRANT_AMOUNT.
export const Claim = ({
  open,
  onClose,
  title,
  available,
  onConfirm,
}: ClaimProps): React.JSX.Element => {
  const [raw, setRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      // Exact, not abbreviated: this is the only record of what the ledger took and it carries no
      // tooltip to recover the digits from.
      toast.success(`Claimed ${formatCCFull(raw)} ${CC.symbol}`)
      onClose()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <TokenInput
        aria-describedby={message === undefined ? undefined : 'claim-amount-error'}
        balance={available}
        className="border-0 p-0"
        id="claim-amount"
        label="Available to claim"
        onChange={(next) => setRaw(next)}
        token={CC}
        usdValue="Not Available"
        value={raw}
      />
      {message !== undefined && (
        <FieldError id="claim-amount-error" message={message} className="mt-2" />
      )}
      <Button
        className="mt-6 w-full"
        size="sm"
        onClick={() => void submit()}
        disabled={!valid || submitting}
      >
        {submitting ? (
          <>
            <SpinnerIcon width={16} height={16} />
            Submitting…
          </>
        ) : (
          'Claim'
        )}
      </Button>
    </Modal>
  )
}
