import { TokenInput } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { inputClass, labelClass } from '@/components/CreateGrant/fields'
import type { FundingToken } from '@/components/CreateGrant/useFundingToken'
import { FieldError } from '@/components/FieldError'
import type { Receiver } from '@/hooks/useReceiver'
import { cn } from '@/utils/cn'

interface DetailsProps {
  amount: string
  funding: FundingToken
  onAmountChange: (value: string) => void
  onReceiverChange: (value: string) => void
  onTitleChange: (value: string) => void
  receiver: string
  receiverIsSelf: boolean
  resolved: Receiver
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
  resolved,
  title,
}: DetailsProps): React.JSX.Element => {
  // A half-typed name is not an error yet: the format is judged once the field is left, while a
  // lookup that found nobody answers after the typing pause anyway.
  const [left, setLeft] = useState(false)
  const receiverMessage = receiverIsSelf
    ? 'Cannot grant to yourself.'
    : left || resolved.username !== undefined
      ? resolved.message
      : undefined
  const describedBy =
    receiverMessage !== undefined
      ? 'receiver-error'
      : resolved.username !== undefined
        ? 'receiver-party'
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
            Receiver
          </label>
          <input
            aria-describedby={describedBy}
            aria-invalid={receiverMessage !== undefined || undefined}
            autoCapitalize="none"
            autoComplete="off"
            className={cn(
              inputClass,
              'font-mono text-sm aria-invalid:border-danger aria-invalid:bg-danger-soft',
            )}
            id="receiver"
            onBlur={() => setLeft(true)}
            onChange={(event) => onReceiverChange(event.target.value)}
            placeholder="username or bob::1220…"
            spellCheck={false}
            value={receiver}
          />
          {receiverMessage === undefined && resolved.username !== undefined && (
            <p id="receiver-party" className="mt-1 truncate font-mono text-xs text-fg-muted">
              {resolved.resolving ? 'Looking up…' : resolved.partyId}
            </p>
          )}
          {receiverMessage !== undefined && (
            <FieldError id="receiver-error" message={receiverMessage} className="mt-1" />
          )}
        </div>
        <div>
          <TokenInput
            {...funding}
            className="w-full border-0 p-0"
            id="amount"
            label="Total amount"
            onChange={onAmountChange}
            usdValue="N/A"
            value={amount}
          />
        </div>
      </div>
    </>
  )
}
