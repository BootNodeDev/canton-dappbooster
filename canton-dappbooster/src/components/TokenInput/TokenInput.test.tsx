import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { formatAmount } from '../../utils/tokenAmount'
import { TokenInput, type TokenMeta } from '.'
import { anatomy } from './anatomy'

const CC: TokenMeta = { symbol: 'CC' }

// The component formats with the ambient locale, so every expectation is derived rather than
// spelled out: hardcoding `1,234` would fail under a comma-decimal locale.
const LOCALE_PARTS = new Intl.NumberFormat(undefined, { numberingSystem: 'latn' }).formatToParts(
  12345.6,
)
const GROUP = LOCALE_PARTS.find((part) => part.type === 'group')?.value ?? ','
const DECIMAL = LOCALE_PARTS.find((part) => part.type === 'decimal')?.value ?? '.'

const setup = (props: Partial<React.ComponentProps<typeof TokenInput>> = {}) => {
  const onChange = vi.fn()
  render(
    <TokenInput
      data-testid="root"
      label="Amount"
      onChange={onChange}
      token={CC}
      value=""
      {...props}
    />,
  )
  return {
    field: screen.getByLabelText<HTMLInputElement>('Amount'),
    onChange,
    root: screen.getByTestId('root'),
  }
}

// No `@testing-library/user-event` in this package; a keystroke at the end of the field is a
// `change` event carrying the appended raw value, which is what a real cursor-at-end keystroke
// sends.
const typeAtEnd = (field: HTMLInputElement, char: string): void => {
  fireEvent.input(field, { inputType: 'insertText', target: { value: field.value + char } })
}

// A real keystroke splices one character in at the live caret and leaves the caret one past it, so
// the next keystroke starts wherever the component just put it. Appending to `field.value` instead
// would make every sequence a same-position append and hide any caret bug by construction.
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

// Typing needs a real reformat-and-recaret cycle, which requires the parent to actually update
// `value` on report; `setup`'s fixed `value` never does.
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
    expect(screen.getByText('CC')).toHaveClass(anatomy.parts.token)
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
    // A '5' typed after the first two digits of the displayed '1,234': the raw '1,2534' regroups to
    // '12,534', a different string, so React does rewrite the DOM here and jsdom would otherwise
    // park the caret at the end — this is the case that actually exercises the caret apparatus,
    // unlike a raw value that happens to already equal its own regrouped form.
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
    // A stray 'x' inserted after the first two digits of the displayed '1,234': sanitizing strips it
    // entirely, so `next` comes back equal to `value` and the keystroke is rejected — but unlike the
    // DOM value (which React's own controlled-input restore would fix regardless), nothing but this
    // component's own code places the caret back where the removed character was typed rather
    // than at the end of the restored '1,234'.
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
    expect(field).toHaveAttribute(anatomy.states.invalid, 'true')
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
    expect(field).toHaveAttribute(anatomy.states.invalid, 'true')
    expect(root).toHaveAttribute(anatomy.states.rootInvalid, 'true')
  })

  it('lets a consumer-supplied aria-invalid survive with no internal error', () => {
    const { field } = setup({ 'aria-invalid': true, value: '1' })
    expect(field).toHaveAttribute(anatomy.states.invalid, 'true')
  })

  it('leaves data-invalid absent from the root when aria-invalid is explicitly false', () => {
    const { root } = setup({ 'aria-invalid': false, value: '1' })
    expect(root).not.toHaveAttribute(anatomy.states.rootInvalid)
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
    expect(field).toHaveAttribute('aria-describedby', `${screen.getByText('CC').id} ${balance.id}`)
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
