import { useEffect, useMemo, useRef, useState } from 'react'
import cantonIcon from '@/assets/canton.png'
import { formatTokenAmount } from '@/cip56/amount'
import { sumDecimalAmounts, type TokenHolding, type TokenHoldingSummary } from '@/cip56/holdings'
import { ContactsPicker } from '@/components/ContactsPicker'
import { SendConfirm } from '@/components/SendConfirm'
import { type Cip56SendApi, SendTokenForm, type TransferDeadline } from '@/components/SendTokenForm'
import { TokenHoldingDetail } from '@/components/TokenHoldingDetail'
import { TokenReceive } from '@/components/TokenReceive'
import { Badge } from '@/components/ui/Badge'
import { SecondaryButton } from '@/components/ui/Button'
import { CHEVRON_RIGHT_ICON, RECEIVE_ICON, SEND_ICON } from '@/components/ui/icons'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Sheet } from '@/components/ui/Sheet'
import { useTokenHoldingDetails } from '@/hooks/useTokenHoldingDetails'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { sortAccounts } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

type Screen = 'detail' | 'send' | 'contacts' | 'confirm' | 'receive' | 'holding'

export interface TokenDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountPublic
  summary: TokenHoldingSummary
  holdingsApi?: Cip56HoldingsApi
  sendApi?: Cip56SendApi
  // Lets the host refresh holdings after a transfer leaves the wallet.
  onSent?: () => void
}

interface DetailScreenProps {
  summary: TokenHoldingSummary
  holdings: TokenHolding[]
  loading: boolean
  error?: string
  onSend: () => void
  onReceive: () => void
  onOpenHolding: (holding: TokenHolding) => void
}

// One holding in the balance-screen list: amount left, chevron right.
const HoldingListRow = ({
  holding,
  onOpen,
}: {
  holding: TokenHolding
  onOpen: () => void
}): JSX.Element => {
  const view = holding.interfaceViewValue
  return (
    <button
      type="button"
      data-testid="holding-row"
      onClick={onOpen}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left outline-none transition-colors hover:bg-primary-soft/40 focus-visible:bg-primary-soft/60"
    >
      <span className="min-w-0">
        <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Amount
        </span>
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-[0.9rem] font-medium text-foreground">
            {formatTokenAmount(view?.amount ?? 'unknown')}
          </span>
          {view?.lock == null ? null : <Badge tone="neutral">Locked</Badge>}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="justify-self-end text-muted-foreground"
      >
        {CHEVRON_RIGHT_ICON}
      </span>
    </button>
  )
}

// Balance-first root screen: total, send/receive, then the holdings list.
const DetailScreen = ({
  summary,
  holdings,
  loading,
  error,
  onSend,
  onReceive,
  onOpenHolding,
}: DetailScreenProps): JSX.Element => (
  <div className="flex flex-col gap-5">
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="break-all font-display text-3xl font-bold tracking-tight text-foreground">
        {formatTokenAmount(summary.totalAmount)}
      </span>
      <span className="flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted-foreground">
        <img
          src={cantonIcon}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="size-4 rounded-full"
        />
        {summary.tokenLabel}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <SecondaryButton
        data-testid="token-send"
        onClick={onSend}
      >
        {SEND_ICON}
        Send
      </SecondaryButton>
      <SecondaryButton
        data-testid="token-receive"
        onClick={onReceive}
      >
        {RECEIVE_ICON}
        Receive
      </SecondaryButton>
    </div>

    <div className="flex min-h-0 flex-col gap-2">
      <SectionLabel>Holdings</SectionLabel>
      <div className="-mx-1 flex h-60 flex-col gap-2 overflow-y-auto px-1">
        {loading && holdings.length === 0 ? (
          <p className="m-0 px-1 text-[0.82rem] text-muted-foreground">Loading UTXOs</p>
        ) : error !== undefined ? (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
            {error}
          </div>
        ) : holdings.length === 0 ? (
          <p className="m-0 px-1 text-[0.82rem] text-muted-foreground">No UTXO details</p>
        ) : (
          holdings.map((holding) => (
            <HoldingListRow
              key={holding.contractId}
              holding={holding}
              onOpen={() => onOpenHolding(holding)}
            />
          ))
        )}
      </div>
    </div>
  </div>
)

// Single token modal: a screen stack inside one sheet. Send-form state lives here so it
// survives the contacts and confirmation screens.
export const TokenDetailSheet = ({
  open,
  onOpenChange,
  account,
  summary,
  holdingsApi,
  sendApi,
  onSent,
}: TokenDetailSheetProps): JSX.Element => {
  const vault = useVault()
  const [screen, setScreen] = useState<Screen>('detail')
  const [activeHolding, setActiveHolding] = useState<TokenHolding | null>(null)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [deadline, setDeadline] = useState<TransferDeadline>('1h')
  const screenRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every screen change to refocus the new view.
  useEffect(() => {
    if (!open) return
    const root = screenRef.current
    if (root === null) return
    const target = root.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    )
    target?.focus()
  }, [open, screen])

  const detailsApi =
    holdingsApi?.listTokenHoldings === undefined
      ? undefined
      : { listTokenHoldings: holdingsApi.listTokenHoldings }
  const { holdings, loading, error } = useTokenHoldingDetails(account, summary, {
    api: detailsApi,
    enabled: open,
  })

  // Spendable balance excludes locked holdings, which would fail on send.
  const spendableBalance = useMemo(
    () =>
      sumDecimalAmounts(
        holdings
          .filter((holding) => holding.interfaceViewValue?.lock == null)
          .map((holding) => holding.interfaceViewValue?.amount)
          .filter((value): value is string => value !== undefined),
      ),
    [holdings],
  )

  const contacts = useMemo(
    () => sortAccounts(vault.accounts).filter((entry) => entry.id !== account.id),
    [vault.accounts, account.id],
  )

  const resetForm = (): void => {
    setRecipient('')
    setAmount('')
    setMemo('')
    setDeadline('1h')
  }

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      setScreen('detail')
      setActiveHolding(null)
      setDirection('forward')
      resetForm()
    }
    onOpenChange(next)
  }

  const goTo = (next: Screen): void => {
    setDirection('forward')
    setScreen(next)
  }

  // Send-flow screens step back to the form; everything else returns to detail.
  const goBack = (): void => {
    if (screen === 'detail') {
      handleOpenChange(false)
      return
    }
    setDirection('back')
    setScreen(screen === 'contacts' || screen === 'confirm' ? 'send' : 'detail')
  }

  const openHolding = (holding: TokenHolding): void => {
    setActiveHolding(holding)
    goTo('holding')
  }

  // After a transfer leaves the wallet, refresh the host and close the whole sheet.
  const handleSent = (): void => {
    onSent?.()
    handleOpenChange(false)
  }

  const sendTitle = `Send ${summary.tokenLabel}`
  const titles: Record<Screen, string> = {
    detail: summary.tokenLabel,
    send: sendTitle,
    confirm: sendTitle,
    contacts: 'Choose recipient',
    receive: 'Receive',
    holding: 'Holding details',
  }
  const title = titles[screen]
  const animationClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      testId="token-detail-sheet"
      title={title}
      description={`${summary.tokenLabel} token details`}
      hideTitle={screen === 'detail'}
      onBack={screen === 'detail' ? undefined : goBack}
      side="center"
    >
      <div
        key={screen}
        ref={screenRef}
        className={animationClass}
      >
        {screen === 'detail' && (
          <DetailScreen
            summary={summary}
            holdings={holdings}
            loading={loading}
            error={error}
            onSend={() => goTo('send')}
            onReceive={() => goTo('receive')}
            onOpenHolding={openHolding}
          />
        )}
        {screen === 'send' && (
          <SendTokenForm
            summary={summary}
            spendableBalance={spendableBalance}
            recipient={recipient}
            amount={amount}
            memo={memo}
            deadline={deadline}
            onRecipientChange={setRecipient}
            onAmountChange={setAmount}
            onMemoChange={setMemo}
            onDeadlineChange={setDeadline}
            onOpenContacts={() => goTo('contacts')}
            onReview={() => goTo('confirm')}
          />
        )}
        {screen === 'contacts' && (
          <ContactsPicker
            contacts={contacts}
            onSelect={(partyId) => {
              setRecipient(partyId)
              setDirection('back')
              setScreen('send')
            }}
          />
        )}
        {screen === 'confirm' && (
          <SendConfirm
            account={account}
            summary={summary}
            recipient={recipient}
            amount={amount}
            memo={memo}
            deadline={deadline}
            sendApi={sendApi}
            onCancel={goBack}
            onSent={handleSent}
          />
        )}
        {screen === 'receive' && <TokenReceive partyId={account.partyId} />}
        {screen === 'holding' && activeHolding !== null && (
          <TokenHoldingDetail holding={activeHolding} />
        )}
      </div>
    </Sheet>
  )
}
