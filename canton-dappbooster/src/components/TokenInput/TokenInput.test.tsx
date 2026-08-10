import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TokenInput, type TokenMeta } from '.'
import { anatomy } from './anatomy'

const CC: TokenMeta = { symbol: 'CC' }

const setup = (props: Partial<React.ComponentProps<typeof TokenInput>> = {}) => {
  const onChange = vi.fn()
  render(<TokenInput label="Amount" onChange={onChange} token={CC} value="" {...props} />)
  return { field: screen.getByLabelText<HTMLInputElement>('Amount'), onChange }
}

// No `@testing-library/user-event` in this package; a keystroke at the end of the field is a
// `change` event carrying the appended raw value, which is what a real cursor-at-end keystroke
// sends.
const typeAtEnd = (field: HTMLInputElement, char: string): void => {
  fireEvent.change(field, { target: { value: field.value + char } })
}

// A real keystroke splices one character in at the live caret and leaves the caret one past it, so
// the next keystroke starts wherever the component just put it. Appending to `field.value` instead
// would make every sequence a same-position append and hide any caret bug by construction.
const type = (field: HTMLInputElement, keys: string): void => {
  for (const key of keys) {
    const at = field.selectionStart ?? field.value.length
    const raw = `${field.value.slice(0, at)}${key}${field.value.slice(at)}`
    fireEvent.change(field, { target: { value: raw, selectionStart: at + 1 } })
  }
}

const backspace = (field: HTMLInputElement, times: number): void => {
  for (let i = 0; i < times; i++) {
    const at = field.selectionStart ?? field.value.length
    if (at === 0) continue
    const raw = `${field.value.slice(0, at - 1)}${field.value.slice(at)}`
    fireEvent.change(field, { target: { value: raw, selectionStart: at - 1 } })
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
    render(<TokenInput className="extra" data-testid="ti" onChange={vi.fn()} token={CC} value="" />)
    expect(screen.getByTestId('ti')).toHaveClass(anatomy.parts.root, 'extra')
  })

  it('associates the label with the field and shows the symbol', () => {
    const { field } = setup()
    expect(field).toHaveClass(anatomy.parts.field)
    expect(screen.getByText('CC')).toHaveClass(anatomy.parts.token)
  })

  it('groups the displayed value and reports the sanitized one', () => {
    const { field, onChange } = setup({ value: '1234' })
    expect(field).toHaveValue('1,234')
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
    // A '5' typed after '1,2' in the displayed '1,234': the raw '1,2534' regroups to '12,534', a
    // different string, so React does rewrite the DOM here and jsdom would otherwise park the
    // caret at the end — this is the case that actually exercises the caret apparatus, unlike a
    // raw value that happens to already equal its own regrouped form.
    fireEvent.change(field, { target: { value: '1,2534', selectionStart: 4 } })
    expect(field).toHaveValue('12,534')
    expect(field.selectionStart).toBe(4)
  })

  it.each([
    ['100.25', '100.25'],
    ['0.5', '0.5'],
    ['.5', '0.5'],
    ['1234.5', '1,234.5'],
    ['1000000', '1,000,000'],
  ])('types %s left to right', (keys, expected) => {
    const field = controlled()
    type(field, keys)
    expect(field).toHaveValue(expected)
  })

  it('deletes back through a separator to an empty field', () => {
    const field = controlled()
    type(field, '1234.5')
    backspace(field, 6)
    expect(field).toHaveValue('')
  })

  it('places the caret correctly when a rejected keystroke is undone mid-string', () => {
    const { field, onChange } = setup({ value: '1234' })
    // A stray 'x' inserted after '1,2' in the displayed '1,234': sanitizing strips it entirely, so
    // `next` comes back equal to `value` and the keystroke is rejected — but unlike the DOM value
    // (which React's own controlled-input restore would fix regardless), nothing but this
    // component's own code places the caret back where the removed character was typed rather
    // than at the end of the restored '1,234'.
    fireEvent.change(field, { target: { value: '1,2x34', selectionStart: 4 } })
    expect(onChange).toHaveBeenLastCalledWith('1234', undefined)
    expect(field).toHaveValue('1,234')
    expect(field.selectionStart).toBe(3)
  })

  it('reports the error alongside the value', () => {
    const { field, onChange } = setup({ balance: '1.5', value: '1' })
    typeAtEnd(field, '9')
    expect(onChange).toHaveBeenLastCalledWith('19', 'above-max')
  })

  it('flags an invalid value on the field and the root', () => {
    render(
      <TokenInput
        balance="1.5"
        data-testid="ti"
        label="Amount"
        onChange={vi.fn()}
        token={CC}
        value="9"
      />,
    )
    expect(screen.getByLabelText('Amount')).toHaveAttribute(anatomy.states.invalid, 'true')
    expect(screen.getByTestId('ti')).toHaveAttribute(anatomy.states.rootInvalid, 'true')
  })

  it('lets a consumer-supplied aria-invalid survive with no internal error', () => {
    const { field } = setup({ 'aria-invalid': true, value: '1' })
    expect(field).toHaveAttribute(anatomy.states.invalid, 'true')
  })

  it('leaves data-invalid absent from the root when aria-invalid is explicitly false', () => {
    render(
      <TokenInput
        aria-invalid={false}
        data-testid="ti"
        label="Amount"
        onChange={vi.fn()}
        token={CC}
        value="1"
      />,
    )
    expect(screen.getByTestId('ti')).not.toHaveAttribute(anatomy.states.rootInvalid)
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

  it('renders the balance readout and describes the field with the token', () => {
    const { field } = setup({ balance: '1250.5' })
    expect(screen.getByText(/1,250.5/)).toHaveClass(anatomy.parts.balance)
    expect(field).toHaveAttribute('aria-describedby', screen.getByText('CC').id)
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
    render(
      <TokenInput
        data-testid="ti"
        disabled
        label="Amount"
        onChange={vi.fn()}
        token={CC}
        value=""
      />,
    )
    expect(screen.getByTestId('ti')).toHaveAttribute(anatomy.states.disabled, 'true')
  })

  it('marks the balance readout busy while loading', () => {
    setup({ balanceState: 'loading' })
    expect(screen.getByText('Balance: 0.00')).toHaveAttribute('aria-busy', 'true')
  })

  it('reads a failed balance as N/A', () => {
    setup({ balanceState: 'error' })
    expect(screen.getByText('Balance: N/A')).toBeInTheDocument()
  })

  it('reads an absent balance as zero rather than as a missing figure', () => {
    setup()
    expect(screen.getByText('Balance: 0.00')).toHaveClass(anatomy.parts.balance)
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

  it('renders the fiat value', () => {
    setup({ usdValue: '~$0.10' })
    expect(screen.getByText('~$0.10')).toHaveClass(anatomy.parts.usdValue)
  })
})
