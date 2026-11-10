import { TokenInput, validateAmount } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { FieldError } from '@/components/FieldError'
import { Modal } from '@/components/Modal'
import { useOnScreen } from '@/hooks/useOnScreen'
import { isPositive } from '@/utils/amount'
import { AMOUNT_ERROR_TEXT } from '@/utils/amountErrorText'
import { errorText } from '@/utils/errorText'
import { formatFigureFull } from '@/utils/format'
import { MIN_GRANT_AMOUNT, meetsRelockFloor } from '@/utils/schedule'
import { toast } from '@/utils/toast'
import { AMT } from '@/utils/tokens'

interface ClaimProps {
  available: string
  backing: string
  onClose: () => void
  onConfirm: (amount: string) => Promise<void>
  title: string
}

export const Claim = ({
  onClose,
  title,
  available,
  backing,
  onConfirm,
}: ClaimProps): React.JSX.Element => {
  const [raw, setRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Dismissible while the request is out, so closing after it would close whatever replaced it.
  const onScreen = useOnScreen()

  const amountError = validateAmount(raw, { max: available })
  const floorOk = meetsRelockFloor(backing, raw)
  const message =
    amountError !== undefined
      ? AMOUNT_ERROR_TEXT[amountError]
      : !floorOk && isPositive(raw)
        ? `Remainder must be 0 or at least ${MIN_GRANT_AMOUNT} AMT (re-lock floor).`
        : undefined

  const valid = amountError === undefined && isPositive(raw) && floorOk

  const submit = async (): Promise<void> => {
    if (!valid) {
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(raw)
      // Exact, not abbreviated: a toast has no tooltip to recover the digits from.
      toast.success(`Claimed ${formatFigureFull(raw)} ${AMT.symbol}`)
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
    <Modal onClose={onClose} title={title}>
      <TokenInput
        aria-describedby={message === undefined ? undefined : 'claim-amount-error'}
        balance={available}
        className="border-0 p-0"
        id="claim-amount"
        label="Available to claim"
        onChange={(next) => setRaw(next)}
        token={AMT}
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
        disabled={!valid}
        pending={submitting}
      >
        Claim
      </Button>
    </Modal>
  )
}
