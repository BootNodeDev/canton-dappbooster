import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountField } from '@/components/AmountField'

describe('AmountField', () => {
  afterEach(() => cleanup())

  it('shows the formatted spendable balance and token', () => {
    render(
      <AmountField
        value=""
        onChange={() => undefined}
        onMax={() => undefined}
        balance="1234.5"
        tokenLabel="Amulet"
      />,
    )
    assert.ok(screen.getByText(/1,234\.50/))
    assert.ok(screen.getByText(/Amulet/))
  })

  it('calls onMax when Max is clicked', async () => {
    let maxed = 0
    render(
      <AmountField
        value=""
        onChange={() => undefined}
        onMax={() => {
          maxed += 1
        }}
        balance="10"
        tokenLabel="Amulet"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /max/i }))
    assert.equal(maxed, 1)
  })

  it('displays the value with comma grouping', () => {
    render(
      <AmountField
        value="1234567.5"
        onChange={() => undefined}
        onMax={() => undefined}
        balance="10"
        tokenLabel="Amulet"
      />,
    )
    assert.equal((screen.getByLabelText('Amount') as HTMLInputElement).value, '1,234,567.5')
  })

  it('strips grouping commas before forwarding to onChange', async () => {
    const values: string[] = []
    render(
      <AmountField
        value=""
        onChange={(v) => values.push(v)}
        onMax={() => undefined}
        balance="10"
        tokenLabel="Amulet"
      />,
    )
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    assert.deepEqual(values, ['5'])
  })
})
