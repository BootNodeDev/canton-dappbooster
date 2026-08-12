import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '../../providers/TokenListProvider'
import type { Token } from '../../providers/TokenListProvider/context'
import { stubViewport } from '../../testing/viewport'
import { formatAmount } from '../../utils/tokenAmount'
import { TokenInput, type TokenMeta } from '.'
import { anatomy } from './anatomy'

const CC: TokenMeta = { symbol: 'CC' }

const TOKENS: Token[] = [
  { id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
]

// Derived through `formatAmount`, so the test agrees with the component rather than with a
// hardcoded `1,234` or its own copy of the Intl lookup.
const GROUP = formatAmount('1234567').replace(/\d/g, '').slice(0, 1) || ','
const DECIMAL = formatAmount('1.1').replace(/\d/g, '') || '.'

const setup = (props: Partial<React.ComponentProps<typeof TokenInput>> = {}) => {
  const onChange = vi.fn()
  // The token select's list windows itself against a height jsdom does not lay out.
  stubViewport(320)
  render(
    <TokenListProvider tokens={TOKENS}>
      <TokenInput
        data-testid="root"
        label="Amount"
        onChange={onChange}
        token={CC}
        value=""
        {...props}
      />
    </TokenListProvider>,
  )
  return {
    field: screen.getByLabelText<HTMLInputElement>('Amount'),
    onChange,
    root: screen.getByTestId('root'),
  }
}

// The element the field points its description at, which is the contract the symbol is under: the
// symbol reads twice now (on the pill and inside its fallback logo), so text is no longer a way in.
const symbol = (field: HTMLInputElement): HTMLElement => {
  const [id] = (field.getAttribute('aria-describedby') ?? '').split(' ')
  return document.getElementById(id) as HTMLElement
}

// No `@testing-library/user-event` in this package, so keystrokes are hand-built input events.
const typeAtEnd = (field: HTMLInputElement, char: string): void => {
  fireEvent.input(field, { inputType: 'insertText', target: { value: field.value + char } })
}

// Splices at the live caret, not at the end: appending would hide any caret bug by construction.
const type = (field: HTMLInputElement, keys: string): void => {
  for (const key of keys.replaceAll('.', DECIMAL)) {
    const at = field.selectionStart ?? field.value.length
    const raw = `${field.value.slice(0, at)}${key}${field.value.slice(at)}`
    fireEvent.input(field, {
      inputType: 'insertText',
      target: { value: raw, selectionStart: at + 1 },
    })
  }
}

const backspace = (field: HTMLInputElement, times: number): void => {
  for (let i = 0; i < times; i++) {
    const at = field.selectionStart ?? field.value.length
    if (at === 0) continue
    const raw = `${field.value.slice(0, at - 1)}${field.value.slice(at)}`
    fireEvent.input(field, {
      inputType: 'deleteContentBackward',
      target: { value: raw, selectionStart: at - 1 },
    })
  }
}

// Typing needs the parent to feed `value` back, which `setup`'s fixed `value` never does.
const Controlled = ({ initial }: { initial: string }) => {
  const [value, setValue] = useState(initial)
  return <TokenInput label="Amount" onChange={(next) => setValue(next)} token={CC} value={value} />
}

const controlled = (initial = ''): HTMLInputElement => {
  render(<Controlled initial={initial} />)
  return screen.getByLabelText<HTMLInputElement>('Amount')
}

describe('TokenInput', () => {
  it('renders the root part and appends a consumer class', () => {
    const { root } = setup({ className: 'extra' })
    expect(root).toHaveClass(anatomy.parts.root, 'extra')
  })

  it('associates the label with the field and shows the symbol', () => {
    const { field } = setup()
    expect(field).toHaveClass(anatomy.parts.field)
    expect(symbol(field)).toHaveTextContent('CC')
  })

  it('groups the displayed value and reports the sanitized one', () => {
    const { field, onChange } = setup({ value: '1234' })
    expect(field).toHaveValue(formatAmount('1234'))
    typeAtEnd(field, '5')
    expect(onChange).toHaveBeenLastCalledWith('12345', undefined)
  })

  it('drops input that can never belong to an amount', () => {
    const { field, onChange } = setup({ value: '1' })
    typeAtEnd(field, 'a')
    expect(onChange).toHaveBeenLastCalledWith('1', undefined)
    expect(field).toHaveValue('1')
  })

  it('anchors the caret to the digits already typed, not to the end', () => {
    const field = controlled('1234')
    // '1,2534' regroups to '12,534', so React rewrites the DOM and jsdom would park the caret at
    // the end. A raw value already equal to its regrouped form would not exercise this.
    const display = field.value
    fireEvent.change(field, {
      target: { value: `${display.slice(0, 3)}5${display.slice(3)}`, selectionStart: 4 },
    })
    expect(field).toHaveValue(formatAmount('12534'))
    expect(field.selectionStart).toBe(4)
  })

  it.each([
    ['100.25', '100.25'],
    ['0.5', '0.5'],
    ['.5', '0.5'],
    ['1234.5', '1234.5'],
    ['1000000', '1000000'],
  ])('types %s left to right', (keys, expected) => {
    const field = controlled()
    type(field, keys)
    expect(field).toHaveValue(formatAmount(expected))
  })

  it('deletes back through a separator to an empty field', () => {
    const field = controlled()
    type(field, '1234.5')
    backspace(field, 6)
    expect(field).toHaveValue('')
  })

  it('deletes the digit a group separator sits against instead of stalling', () => {
    const field = controlled('1234567')
    const at = field.value.lastIndexOf(GROUP) + 1
    field.setSelectionRange(at, at)
    backspace(field, 1)
    expect(field).toHaveValue(formatAmount('123567'))
    backspace(field, 1)
    expect(field).toHaveValue(formatAmount('12567'))
  })

  it('deletes forward past a group separator', () => {
    const field = controlled('1234567')
    const at = field.value.lastIndexOf(GROUP)
    field.setSelectionRange(at, at)
    fireEvent.input(field, {
      inputType: 'deleteContentForward',
      target: {
        value: `${field.value.slice(0, at)}${field.value.slice(at + 1)}`,
        selectionStart: at,
      },
    })
    expect(field).toHaveValue(formatAmount('123467'))
  })

  it('places the caret correctly when a rejected keystroke is undone mid-string', () => {
    const { field, onChange } = setup({ value: '1234' })
    // Sanitizing strips the 'x', so `next` equals `value` and no re-render comes. React would
    // restore the DOM value anyway; only the component restores the caret.
    const display = field.value
    fireEvent.change(field, {
      target: { value: `${display.slice(0, 3)}x${display.slice(3)}`, selectionStart: 4 },
    })
    expect(onChange).toHaveBeenLastCalledWith('1234', undefined)
    expect(field).toHaveValue(display)
    expect(field.selectionStart).toBe(3)
  })

  it('reports the error alongside the value', () => {
    const { field, onChange } = setup({ balance: '1.5', value: '1' })
    typeAtEnd(field, '9')
    expect(onChange).toHaveBeenLastCalledWith('19', 'above-max')
  })

  it('flags a balance it cannot read rather than dropping the cap', () => {
    const { field, onChange } = setup({ balance: `1${GROUP}250${DECIMAL}50`, value: '1' })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    typeAtEnd(field, '9')
    expect(onChange).toHaveBeenLastCalledWith('19', 'invalid-max')
  })

  it('reports a pasted exponent as invalid instead of salvaging a number from it', () => {
    const { field, onChange } = setup({ value: '' })
    fireEvent.change(field, { target: { value: `1${DECIMAL}5e3` } })
    expect(onChange).toHaveBeenLastCalledWith('1.5e3', 'not-a-number')
  })

  it('flags an invalid value on the field and the root', () => {
    const { field, root } = setup({ balance: '1.5', value: '9' })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(root).toHaveAttribute(anatomy.states.invalid, 'true')
  })

  it('lets a consumer-supplied aria-invalid survive with no internal error', () => {
    const { field, root } = setup({ 'aria-invalid': true, value: '1' })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(root).toHaveAttribute(anatomy.states.invalid, 'true')
  })

  it('leaves data-invalid absent from the root when aria-invalid is explicitly false', () => {
    const { root } = setup({ 'aria-invalid': false, value: '1' })
    expect(root).not.toHaveAttribute(anatomy.states.invalid)
  })

  it('lets aria-label name the field with no visible label', () => {
    render(<TokenInput aria-label="Amount" onChange={vi.fn()} token={CC} value="" />)
    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
  })

  it('settles a dangling separator on blur', () => {
    const { field, onChange } = setup({ value: '1.' })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenLastCalledWith('1', undefined)
  })

  it('fills the exact balance from Max', () => {
    const { onChange } = setup({ balance: '8421337.1234567891' })
    const maxButton = screen.getByRole('button', { name: 'Max' })
    expect(maxButton).toHaveAttribute('type', 'button')
    fireEvent.click(maxButton)
    expect(onChange).toHaveBeenLastCalledWith('8421337.1234567891', undefined)
  })

  it('renders the balance readout and describes the field with the token and the balance', () => {
    const { field } = setup({ balance: '1250.5' })
    const balance = screen.getByText(`Balance: ${formatAmount('1250.5')}`)
    expect(balance).toHaveClass(anatomy.parts.balance)
    expect(field).toHaveAttribute('aria-describedby', `${symbol(field).id} ${balance.id}`)
  })

  it('announces the balance as it settles', () => {
    setup({ balance: '5' })
    expect(screen.getByRole('status')).toHaveClass(anatomy.parts.balance)
  })

  it('describes Max with the balance it fills', () => {
    setup({ balance: '5' })
    const balance = screen.getByText('Balance: 5')
    expect(screen.getByRole('button', { name: 'Max' })).toHaveAttribute(
      'aria-describedby',
      balance.id,
    )
  })

  it('marks the root disabled so the theme can dim it', () => {
    const { root } = setup({ disabled: true })
    expect(root).toHaveAttribute(anatomy.states.disabled, 'true')
  })

  it('leaves the symbol inert with no handler to change the token', () => {
    const { field } = setup()
    expect(screen.queryByRole('button', { name: 'CC' })).not.toBeInTheDocument()
    expect(symbol(field)).toHaveTextContent('CC')
  })

  // One part class covers both renderings, so this attribute is all the theme has to keep the
  // button's cursor and hover off the inert span.
  it('leaves the inert symbol unmarked so the theme does not style it as a button', () => {
    const { field } = setup()
    expect(symbol(field)).not.toHaveAttribute(anatomy.states.interactive)
  })

  it('marks the symbol interactive when it opens the token select', () => {
    setup({ onTokenSelect: vi.fn() })
    expect(screen.getByRole('button', { name: 'CC' })).toHaveAttribute(
      anatomy.states.interactive,
      'true',
    )
  })

  it('opens the token select on the symbol button', () => {
    setup({ onTokenSelect: vi.fn() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CC' }))
    expect(screen.getByRole('dialog', { name: 'Select a token' })).toBeInTheDocument()
  })

  it('reports the open state on the trigger and points it at the dialog', () => {
    setup({ onTokenSelect: vi.fn() })
    const trigger = screen.getByRole('button', { name: 'CC' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveAttribute('aria-controls')
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls', dialog.id)
  })

  it('clears the open state from the trigger once the dialog is gone', async () => {
    setup({ onTokenSelect: vi.fn() })
    const trigger = screen.getByRole('button', { name: 'CC' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveAttribute('aria-controls')
  })

  it('closes the token select on Escape', async () => {
    setup({ onTokenSelect: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'CC' }))
    // Zag arms the dismiss listeners a frame after the dialog mounts.
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    fireEvent.keyDown(screen.getByLabelText('Search tokens'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('returns focus to the trigger when the token select closes', async () => {
    setup({ onTokenSelect: vi.fn() })
    const trigger = screen.getByRole('button', { name: 'CC' })
    fireEvent.click(trigger)
    // The focus trap arms a frame after the dialog mounts; a close before that returns nothing.
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('hands the picked token to the consumer and closes the select', async () => {
    const onTokenSelect = vi.fn()
    setup({ onTokenSelect })
    fireEvent.click(screen.getByRole('button', { name: 'CC' }))
    screen.getByRole('button', { name: 'USD Coin USDC' }).click()
    expect(onTokenSelect).toHaveBeenCalledWith(TOKENS[1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  // The trigger reads the `token` prop, so only a consumer that stores the pick shows the new one.
  it('shows the picked token on the trigger once the consumer stores it', async () => {
    const Harness = (): React.JSX.Element => {
      const [token, setToken] = useState<TokenMeta>(CC)
      return (
        <TokenListProvider tokens={TOKENS}>
          <TokenInput
            label="Amount"
            onChange={vi.fn()}
            onTokenSelect={setToken}
            token={token}
            value=""
          />
        </TokenListProvider>
      )
    }
    stubViewport(320)
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'CC' }))
    screen.getByRole('button', { name: 'USD Coin USDC' }).click()

    await waitFor(() => expect(screen.getByRole('button', { name: 'USDC' })).toBeInTheDocument())
  })

  it('marks the row of the token the field is on', () => {
    setup({ onTokenSelect: vi.fn(), token: TOKENS[0] })
    fireEvent.click(screen.getByRole('button', { name: 'CC' }))
    expect(screen.getByRole('button', { name: 'Canton Coin CC' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('describes the field with the symbol rather than with the trigger', () => {
    const { field } = setup({ onTokenSelect: vi.fn() })
    const [tokenId] = (field.getAttribute('aria-describedby') ?? '').split(' ')
    expect(document.getElementById(tokenId)).toHaveTextContent('CC')
    expect(screen.getByRole('button', { name: 'CC' })).not.toHaveAttribute('id', tokenId)
  })

  it('disables the token select while the field is disabled', () => {
    setup({ disabled: true, onTokenSelect: vi.fn() })
    const trigger = screen.getByRole('button', { name: 'CC' })
    expect(trigger).toBeDisabled()
    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks the balance readout busy while loading', () => {
    setup({ balanceState: 'loading' })
    expect(screen.getByText(`Balance: ${formatAmount('0.00')}`)).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('reads a failed balance as N/A', () => {
    setup({ balanceState: 'error' })
    expect(screen.getByText('Balance: N/A')).toBeInTheDocument()
  })

  it('reads an absent balance as zero rather than as a missing figure', () => {
    setup()
    expect(screen.getByText(`Balance: ${formatAmount('0.00')}`)).toHaveClass(anatomy.parts.balance)
  })

  it.each([
    ['the balance is zero', { balance: '0' }],
    ['the balance is still loading', { balanceState: 'loading' as const }],
    ['the balance read errored', { balanceState: 'error' as const }],
    ['the field itself is disabled', { balance: '5', disabled: true }],
  ])('disables Max when %s', (_label, props) => {
    setup(props)
    expect(screen.getByRole('button', { name: 'Max' })).toBeDisabled()
  })

  it('renders the fiat value the consumer passed, with the component supplying the mark', () => {
    setup({ usdValue: '0.10' })
    expect(screen.getByText('0.10')).toHaveClass(anatomy.parts.usdValue)
    expect(screen.getByText('0.10').parentElement).toHaveTextContent(/^~\$0\.10/)
  })
})
