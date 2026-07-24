import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import {
  DEADLINE_OPTIONS,
  SendTokenForm,
  transferDeadlineExpiration,
} from '@/components/SendTokenForm'
import { TooltipProvider } from '@/components/ui/Tooltip'

const SUMMARY: TokenHoldingSummary = {
  key: 'dso::party:Amulet',
  tokenLabel: 'Amulet',
  instrumentId: { admin: 'dso::party', id: 'Amulet' },
  totalAmount: '12.5',
  source: 'scan',
}

interface Handlers {
  onRecipientChange?: (v: string) => void
  onAmountChange?: (v: string) => void
  onMemoChange?: (v: string) => void
  onOpenContacts?: () => void
  onReview?: () => void
}

const renderForm = (
  props: Partial<{ recipient: string; amount: string; memo: string }> & Handlers = {},
): void => {
  render(
    <TooltipProvider>
      <SendTokenForm
        summary={SUMMARY}
        spendableBalance="12.5"
        recipient={props.recipient ?? ''}
        amount={props.amount ?? ''}
        memo={props.memo ?? ''}
        deadline="1h"
        onRecipientChange={props.onRecipientChange ?? (() => undefined)}
        onAmountChange={props.onAmountChange ?? (() => undefined)}
        onMemoChange={props.onMemoChange ?? (() => undefined)}
        onDeadlineChange={() => undefined}
        onOpenContacts={props.onOpenContacts ?? (() => undefined)}
        onReview={props.onReview ?? (() => undefined)}
      />
    </TooltipProvider>,
  )
}

describe('SendTokenForm', () => {
  afterEach(() => cleanup())

  it('renders a Recipient field (not "Recipient party") and no Token field', () => {
    renderForm()
    assert.ok(screen.getByLabelText('Recipient'))
    assert.equal(screen.queryByLabelText('Recipient party'), null)
    assert.equal(screen.queryByLabelText('Token'), null)
  })

  it('forwards field edits to the controlled handlers', async () => {
    const recipients: string[] = []
    const memos: string[] = []
    renderForm({
      onRecipientChange: (v) => recipients.push(v),
      onMemoChange: (v) => memos.push(v),
    })
    await userEvent.type(screen.getByLabelText('Recipient'), 'x')
    await userEvent.type(screen.getByLabelText('Memo'), 'y')
    assert.deepEqual(recipients, ['x'])
    assert.deepEqual(memos, ['y'])
  })

  it('opens contacts from the contacts button', async () => {
    let opened = 0
    renderForm({ onOpenContacts: () => (opened += 1) })
    await userEvent.click(screen.getByRole('button', { name: /contacts/i }))
    assert.equal(opened, 1)
  })

  it('disables Review until recipient and a positive amount within balance are set', async () => {
    let reviewed = 0
    renderForm({ onReview: () => (reviewed += 1) })
    assert.equal(
      (screen.getByRole('button', { name: 'Review' }) as HTMLButtonElement).disabled,
      true,
    )
    cleanup()

    renderForm({ recipient: 'bob::party', amount: '5', onReview: () => (reviewed += 1) })
    const review = screen.getByRole('button', { name: 'Review' })
    assert.equal((review as HTMLButtonElement).disabled, false)
    await userEvent.click(review)
    assert.equal(reviewed, 1)
  })

  it('blocks Review when amount exceeds spendable balance', () => {
    renderForm({ recipient: 'bob::party', amount: '999' })
    assert.equal(
      (screen.getByRole('button', { name: 'Review' }) as HTMLButtonElement).disabled,
      true,
    )
  })

  it('still computes calendar deadline expirations from presets', () => {
    const now = new Date('2026-06-10T12:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1h', now).toISOString(), '2026-06-10T13:00:00.000Z')
    assert.equal(transferDeadlineExpiration('1m', now).toISOString(), '2026-07-10T12:00:00.000Z')
    assert.equal(DEADLINE_OPTIONS.length, 5)
  })
})
