import { TokenInput, tokenKey, useTokenList, validateAmount } from '@bootnodedev/canton-dappbooster'
import { ArrowDown } from 'lucide-react'
import { useState } from 'react'
import type { RequestKind } from '@/backend/commands'
import type { Deployment } from '@/backend/deployment'
import type { VaultBackend } from '@/backend/VaultBackend'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Pills } from '@/components/Pills'
import { FieldError } from '@/pages/Vault/FieldError'
import { KIND_TEXT, SENT } from '@/pages/Vault/requestKind'
import { useVaultStore } from '@/store/useVaultStore'
import { isPositive } from '@/utils/amount'
import { AMOUNT_ERROR_TEXT } from '@/utils/amountErrorText'
import { errorText } from '@/utils/errorText'
import { toast } from '@/utils/toast'
import { USDX, VSH } from '@/utils/tokens'

const KINDS = [
  { value: 'deposit', label: KIND_TEXT.deposit },
  { value: 'withdraw', label: KIND_TEXT.withdraw },
] as const satisfies readonly { label: string; value: RequestKind }[]

const STEPS = ['You propose', 'The vault accepts', 'You fund it', 'The vault settles']

export const ProposalForm = ({
  backend,
  deployment,
  partyId,
}: {
  backend: VaultBackend
  deployment: Deployment
  partyId: string
}): React.JSX.Element => {
  const { byKey } = useTokenList()
  const propose = useVaultStore((state) => state.propose)
  const [kind, setKind] = useState<RequestKind>('deposit')
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)

  const send = SENT[kind]
  const receive = kind === 'deposit' ? VSH : USDX
  const sent = kind === 'deposit' ? deployment.underlying : deployment.share
  const balance = byKey.get(tokenKey(sent))?.balance
  const errorId = `${kind}-amount-error`
  // From the balance on every render, since the poll moves the ceiling under a stored error.
  const amountError = validateAmount(raw, balance === undefined ? {} : { max: balance })
  const message = amountError === undefined ? undefined : AMOUNT_ERROR_TEXT[amountError]
  const valid = amountError === undefined && isPositive(raw)

  const switchKind = (next: RequestKind): void => {
    setKind(next)
    setRaw('')
  }

  const submit = async (): Promise<void> => {
    setPending(true)
    try {
      await propose(backend, partyId, kind, raw)
      setRaw('')
      toast.success(`Proposed a ${kind} of ${raw} ${send.symbol}`)
    } catch (err: unknown) {
      toast.error(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <Pills
        className="flex w-full"
        label="Deposit or withdraw"
        onChange={switchKind}
        options={KINDS}
        value={kind}
        variant="segmented"
      />
      <div className="mt-4 rounded-control border border-border bg-surface-2 px-4 py-3">
        <TokenInput
          aria-describedby={message === undefined ? undefined : errorId}
          balance={balance}
          balanceState={balance === undefined ? 'loading' : undefined}
          className="border-0 p-0"
          id={`${kind}-amount`}
          label={`You ${kind}`}
          onChange={setRaw}
          token={send}
          // Unset, the field reads `~$0.00`, a price of zero; nothing here quotes either token.
          usdValue="Not available"
          value={raw}
        />
      </div>
      <div className="relative z-10 -my-3 flex justify-center">
        <span className="grid size-9 place-items-center rounded-control border-4 border-surface bg-surface-2 text-fg-muted">
          <ArrowDown size={16} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-4 py-4">
        <div>
          <div className="text-[0.85rem] font-semibold text-fg-muted">You receive</div>
          <AmountDisplay
            className="mt-1 text-[1.75rem] font-semibold tracking-tight"
            markSize="small"
            token={receive}
            value={isPositive(raw) && amountError === undefined ? raw : '0'}
          />
        </div>
        <span className="text-sm font-semibold text-fg-muted tabular-nums">
          1 {send.symbol} = 1 {receive.symbol}
        </span>
      </div>
      {message !== undefined && <FieldError className="mt-3" id={errorId} message={message} />}
      <Button
        className="mt-5 w-full"
        disabled={!valid}
        onClick={() => void submit()}
        pending={pending}
        size="lg"
      >
        {`Propose ${kind}`}
      </Button>
      <ol className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
        {STEPS.map((step, index) => (
          <li
            className="flex flex-col gap-1.5 text-[0.8rem] font-semibold text-fg-muted"
            key={step}
          >
            <span
              aria-hidden="true"
              className="grid size-5.5 place-items-center rounded-full bg-surface-2 text-[0.7rem] text-fg"
            >
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </Card>
  )
}
