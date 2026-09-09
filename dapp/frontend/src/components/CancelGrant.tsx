import { useEffect, useRef, useState } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { FieldError } from '@/components/FieldError'
import { Modal } from '@/components/Modal'
import type { Grant } from '@/store/types'
import { deriveGrant } from '@/store/useVestingStore'
import { errorText } from '@/utils/errorText'
import { MIN_GRANT_AMOUNT, residualMeetsFloor } from '@/utils/schedule'
import { toast } from '@/utils/toast'

interface CancelGrantProps {
  description: string
  grant: Grant
  nowMs: number
  onClose: () => void
  onConfirm: () => Promise<void>
  successMessage: string
}

// Cancel-grant confirmation shared by the dashboard and grant-detail pages. Like Claim, it
// owns the submit, toast, error and submitting lifecycle so the pages do not.
export const CancelGrant = ({
  onClose,
  grant,
  nowMs,
  description,
  successMessage,
  onConfirm,
}: CancelGrantProps): React.JSX.Element => {
  const [submitting, setSubmitting] = useState(false)
  const derived = deriveGrant(grant, nowMs)
  // Recomputed each tick with `nowMs`, so a residual growing past the floor re-enables the button
  // on its own rather than sending a submission the contract will assert on.
  const floorOk = residualMeetsFloor(derived.claimable)
  // Only the confirm button is disabled while a submission is in flight, so the dialog can still be
  // dismissed over the wallet prompt. Closing then would close whichever dialog has since taken its
  // place; the toast still fires, because the cancel did land.
  const onScreen = useRef(true)
  // Set on mount and not only cleared on unmount, because StrictMode runs setup, cleanup, setup: a
  // ref the cleanup alone touches reads false from the first render onwards.
  useEffect(() => {
    onScreen.current = true
    return () => {
      onScreen.current = false
    }
  }, [])

  const submit = async (): Promise<void> => {
    setSubmitting(true)
    try {
      await onConfirm()
      toast.success(successMessage)
      if (onScreen.current) {
        onClose()
      }
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Cancel grant" description={description}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-bg/40 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-fg-muted">Returned to you</span>
            <AmountDisplay value={derived.unvested} className="font-semibold" />
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-fg-muted">Residual to receiver</span>
            <AmountDisplay value={derived.claimable} className="font-semibold" />
          </div>
        </div>
        {!floorOk && (
          <FieldError
            id="cancel-residual-floor"
            message={`The residual must be 0 or at least ${MIN_GRANT_AMOUNT} DBT. Cancel once more has vested, or let the receiver claim it down to zero.`}
          />
        )}
        <Button
          className="mt-2 w-full"
          variant="danger"
          size="sm"
          onClick={() => void submit()}
          disabled={!floorOk}
          pending={submitting}
          aria-describedby={floorOk ? undefined : 'cancel-residual-floor'}
        >
          Cancel grant
        </Button>
      </div>
    </Modal>
  )
}
