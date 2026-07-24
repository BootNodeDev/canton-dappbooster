import { type ReactNode, useState } from 'react'
import { formatTokenAmount } from '@/cip56/amount'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { transferTimeLabel } from '@/cip56/transfers'
import {
  type Cip56SendApi,
  defaultSendApi,
  type TransferDeadline,
  transferDeadlineExpiration,
} from '@/components/SendTokenForm'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { JsonView } from '@/components/ui/JsonView'
import { toast } from '@/components/ui/toast'
import { shortMiddle } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface SendConfirmProps {
  account: AccountPublic
  summary: TokenHoldingSummary
  recipient: string
  amount: string
  memo: string
  deadline: TransferDeadline
  sendApi?: Cip56SendApi
  onCancel: () => void
  onSent: () => void
}

const Row = ({ label, children }: { label: string; children: ReactNode }): JSX.Element => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-[0.78rem] font-semibold text-muted-foreground">{label}</span>
    <span className="min-w-0 break-all text-right text-[0.86rem] text-foreground">{children}</span>
  </div>
)

// Confirmation screen: human-readable summary, the raw request JSON behind an expander,
// then the actual submit. Carpincho stays the signer of the prepared transaction.
export const SendConfirm = ({
  account,
  summary,
  recipient,
  amount,
  memo,
  deadline,
  sendApi = defaultSendApi,
  onCancel,
  onSent,
}: SendConfirmProps): JSX.Element => {
  const vault = useVault()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)

  const expirationDate = transferDeadlineExpiration(deadline).toISOString()
  const trimmedMemo = memo.trim()
  // Shared by the inspector JSON and the actual submission so the two cannot drift.
  const shared = {
    recipient: recipient.trim(),
    amount: amount.trim(),
    ...(trimmedMemo === '' ? {} : { memo: trimmedMemo }),
    expirationDate,
  }
  const request = { sender: account.partyId, instrumentId: summary.instrumentId?.id, ...shared }

  const onConfirm = async (): Promise<void> => {
    if (summary.instrumentId?.id === undefined) {
      setSubmitError('Token is missing an instrument id')
      return
    }
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      await sendApi.createTokenTransfer({
        account,
        instrumentId: summary.instrumentId,
        ...shared,
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      toast.success('Transfer submitted.')
      onSent()
    } catch (err) {
      const message = (err as Error).message
      setSubmitError(message)
      toast.error(`Send failed: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {submitError === undefined ? null : (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {submitError}
        </div>
      )}

      <div className="divide-y divide-border rounded-md border border-border px-3 py-1">
        <Row label="To">{shortMiddle(recipient.trim(), 12, 7)}</Row>
        <Row label="Amount">
          {formatTokenAmount(amount.trim())} {summary.tokenLabel}
        </Row>
        <Row label="Expires">{transferTimeLabel(expirationDate)}</Row>
        {trimmedMemo === '' ? null : <Row label="Memo">{trimmedMemo}</Row>}
      </div>

      <details className="rounded-md border border-border bg-surface">
        <summary
          data-testid="send-view-data"
          className="cursor-pointer select-none px-3 py-2 text-[0.78rem] font-semibold text-muted-foreground"
        >
          View data
        </summary>
        <div className="border-t border-border">
          <JsonView
            value={request}
            className="rounded-none border-0"
          />
        </div>
      </details>

      <div className="grid grid-cols-2 gap-3">
        <SecondaryButton
          data-testid="send-cancel"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </SecondaryButton>
        <PrimaryButton
          data-testid="send-confirm"
          disabled={submitting}
          onClick={() => {
            void onConfirm()
          }}
        >
          {submitting ? 'Sending...' : 'Confirm'}
        </PrimaryButton>
      </div>
    </div>
  )
}
