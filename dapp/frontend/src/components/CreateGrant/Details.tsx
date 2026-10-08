import { type PartyIdError, PartyIdInput, TokenInput } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { inputClass, labelClass } from '@/components/CreateGrant/fields'
import type { FundingToken } from '@/components/CreateGrant/useFundingToken'
import { FieldError } from '@/components/FieldError'
import { cn } from '@/utils/cn'

const RECEIVER_MESSAGE: Record<PartyIdError, string> = {
  'missing-separator': 'Use a full party id (hint::fingerprint).',
  'invalid-hint': 'The hint before :: cannot be blank or contain spaces.',
  'invalid-fingerprint': 'The fingerprint after :: must be 68 hex characters.',
}

interface DetailsProps {
  amount: string
  funding: FundingToken
  onAmountChange: (value: string) => void
  onReceiverChange: (value: string) => void
  onTitleChange: (value: string) => void
  receiver: string
  receiverIsSelf: boolean
  title: string
}

// What the grant is, who gets it and how much.
export const Details = ({
  amount,
  funding,
  onAmountChange,
  onReceiverChange,
  onTitleChange,
  receiver,
  receiverIsSelf,
  title,
}: DetailsProps): React.JSX.Element => {
  const [malformed, setMalformed] = useState<PartyIdError | undefined>(undefined)
  const receiverMessage =
    malformed !== undefined
      ? RECEIVER_MESSAGE[malformed]
      : receiverIsSelf
        ? 'Cannot grant to your own party.'
        : undefined

  return (
    <>
      <label htmlFor="title" className={labelClass}>
        Title
      </label>
      <input
        id="title"
        data-autofocus
        required
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="What is this grant for?"
        className={inputClass}
      />
      <div className="mt-4 flex gap-4 flex-col">
        <div>
          <label htmlFor="receiver" className={labelClass}>
            Receiver party id
          </label>
          <PartyIdInput
            aria-describedby={receiverMessage === undefined ? undefined : 'receiver-error'}
            aria-invalid={receiverIsSelf || undefined}
            className={cn(
              inputClass,
              'font-mono text-sm aria-invalid:border-danger aria-invalid:bg-danger-soft',
            )}
            id="receiver"
            onChange={(value, error) => {
              onReceiverChange(value)
              setMalformed(error)
            }}
            placeholder="bob::1220…"
            value={receiver}
          />
          {receiverMessage !== undefined && (
            <FieldError id="receiver-error" message={receiverMessage} className="mt-1" />
          )}
        </div>
        <div>
          <TokenInput
            {...funding}
            aria-describedby="amount-reservation"
            className="w-full border-0 p-0"
            id="amount"
            label="Total amount"
            onChange={onAmountChange}
            usdValue="N/A"
            value={amount}
          />
          <p className="mt-1 text-xs text-fg-muted" id="amount-reservation">
            An outstanding grant reserves exactly this amount; the rest of your balance stays
            spendable. Cancel the grant from Pending to release it before the receiver accepts.
          </p>
        </div>
      </div>
    </>
  )
}
