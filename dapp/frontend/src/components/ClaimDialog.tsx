import { useEffect, useState } from 'react'
import { claimAmountInput, clampClaimAmount, formatCC, formatCCFull } from '@/lib/format'
import { MIN_GRANT_AMOUNT } from '@/lib/schedule'
import { Button } from './Button'
import { Modal } from './Modal'
import { toast } from './toast'

interface ClaimDialogProps {
  open: boolean
  onClose: () => void
  title: string
  available: number
  actionLabel?: string
  // Submits the ledger command; the dialog awaits it and closes on success.
  onConfirm: (amount: number) => Promise<void>
}

// Amount-entry dialog shared by grant withdraw and residual claim. Enforces the
// re-lock floor: the remainder must be 0 or >= min. No mock signing — onConfirm is
// the real ledger submit.
export const ClaimDialog = ({
  open,
  onClose,
  title,
  available,
  actionLabel = 'Claim',
  onConfirm,
}: ClaimDialogProps): React.JSX.Element => {
  const [raw, setRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setRaw(claimAmountInput(available))
    }
  }, [open, available])

  const amount = Number(raw)
  const remainder = available - amount
  const validFloor = remainder <= 1e-9 || remainder >= MIN_GRANT_AMOUNT
  const valid = Number.isFinite(amount) && amount > 0 && amount <= available + 1e-9 && validFloor

  const submit = async (): Promise<void> => {
    if (!valid) {
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(clampClaimAmount(amount, available))
      toast.success(`${actionLabel}ed ${formatCC(amount)} CC`)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={`Available to ${actionLabel.toLowerCase()}: ${formatCCFull(available)} CC`}
    >
      <label
        htmlFor="claim-amount"
        className="block text-xs font-semibold uppercase tracking-[0.06em] text-fg-muted"
      >
        Amount (CC)
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:shadow-[var(--ring)]">
        <input
          id="claim-amount"
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ''))}
          className="h-11 w-full bg-transparent font-mono text-lg text-fg outline-none"
          placeholder="0"
        />
        <button
          type="button"
          onClick={() => setRaw(claimAmountInput(available))}
          className="shrink-0 rounded-lg border border-border-strong px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-fg-muted transition-colors hover:border-primary hover:text-primary"
        >
          Max
        </button>
      </div>
      {!validFloor && amount > 0 && (
        <p className="mt-2 text-xs text-danger">
          Remainder must be 0 or at least {MIN_GRANT_AMOUNT} CC (re-lock floor).
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2.5">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={!valid || submitting}>
          {submitting ? 'Submitting…' : actionLabel}
        </Button>
      </div>
    </Modal>
  )
}
