import { TokenInput, tokenKey, useTokenList, validateAmount } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import type { RequestKind } from '@/backend/commands'
import type { Deployment } from '@/backend/deployment'
import type { VaultBackend } from '@/backend/VaultBackend'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { FieldError } from '@/pages/Vault/FieldError'
import { useVaultStore } from '@/store/useVaultStore'
import { isPositive } from '@/utils/amount'
import { AMOUNT_ERROR_TEXT } from '@/utils/amountErrorText'
import { errorText } from '@/utils/errorText'
import { toast } from '@/utils/toast'
import { USDX, VSH } from '@/utils/tokens'

const TITLE: Record<RequestKind, string> = { deposit: 'Deposit', withdraw: 'Withdraw' }

export const ProposalForm = ({
  backend,
  deployment,
  kind,
  partyId,
}: {
  backend: VaultBackend
  deployment: Deployment
  kind: RequestKind
  partyId: string
}): React.JSX.Element => {
  const { byKey } = useTokenList()
  const propose = useVaultStore((state) => state[kind])
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)

  const [send, receive] = kind === 'deposit' ? [USDX, VSH] : [VSH, USDX]
  const sent = kind === 'deposit' ? deployment.underlying : deployment.share
  const balance = byKey.get(tokenKey(sent))?.balance
  const errorId = `${kind}-amount-error`
  // From the balance on every render, since the poll moves the ceiling under a stored error.
  const amountError = validateAmount(raw, balance === undefined ? {} : { max: balance })
  const message = amountError === undefined ? undefined : AMOUNT_ERROR_TEXT[amountError]
  const valid = amountError === undefined && isPositive(raw)

  const submit = async (): Promise<void> => {
    setPending(true)
    try {
      await propose(backend, partyId, raw)
      setRaw('')
      toast.success(`Proposed a ${kind} of ${raw} ${send.symbol}`)
    } catch (err: unknown) {
      toast.error(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-base font-bold">{TITLE[kind]}</h2>
      <TokenInput
        aria-describedby={message === undefined ? undefined : errorId}
        balance={balance}
        balanceState={balance === undefined ? 'loading' : undefined}
        className="border-0 p-0"
        id={`${kind}-amount`}
        label={`Your ${send.symbol}`}
        onChange={setRaw}
        token={send}
        // Unset, the field reads `~$0.00`, a price of zero; nothing here quotes either token.
        usdValue="Not available"
        value={raw}
      />
      {message !== undefined && <FieldError className="mt-2" id={errorId} message={message} />}
      <Button
        className="mt-5 w-full"
        disabled={!valid}
        onClick={() => void submit()}
        pending={pending}
        size="sm"
      >
        {`${TITLE[kind]} ${send.symbol}`}
      </Button>
      <p className="mt-3 text-xs text-fg-muted">
        {`The vault accepts the proposal, then you fund it. You get ${receive.symbol} one for one.`}
      </p>
    </Card>
  )
}
