import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PartyIdError } from '../../utils/partyId'
import { PartyIdInput, type PartyIdInputProps } from '.'
import { anatomy } from './anatomy'

const VALID = 'nico::1220bacae18ee76cbead16253ac8dbc811bdd759f99cbabc84bc4b2354a9f6a5e13c'

type HarnessProps = Omit<PartyIdInputProps, 'onChange' | 'value'> & {
  initial?: string
  onReport?: (value: string, error: PartyIdError | undefined) => void
}

// The component is controlled, so every test drives it through a real state holder.
const Harness = ({ initial = '', onReport, ...rest }: HarnessProps) => {
  const [value, setValue] = useState(initial)
  return (
    <PartyIdInput
      value={value}
      onChange={(next, error) => {
        setValue(next)
        onReport?.(next, error)
      }}
      {...rest}
    />
  )
}

const field = () => screen.getByRole('textbox')
const type = (value: string) => fireEvent.change(field(), { target: { value } })

describe('PartyIdInput', () => {
  it('renders a text field carrying the root part', () => {
    render(<Harness />)
    expect(field()).toHaveClass(anatomy.parts.root)
  })

  it('appends a consumer class to the root part', () => {
    render(<Harness className="extra" />)
    expect(field()).toHaveClass(anatomy.parts.root, 'extra')
  })

  it('lands consumer attributes on the input, not on a wrapper', () => {
    render(<Harness aria-describedby="receiver-error" placeholder="bob::1220…" />)
    expect(field()).toHaveAttribute('aria-describedby', 'receiver-error')
    expect(field()).toHaveAttribute('placeholder', 'bob::1220…')
  })

  it('reports every change', () => {
    const onReport = vi.fn()
    render(<Harness onReport={onReport} />)
    type('nico')
    expect(onReport).toHaveBeenCalledWith('nico', undefined)
    expect(field()).toHaveValue('nico')
  })

  it('flags nothing while the field has never been blurred', () => {
    const onReport = vi.fn()
    render(<Harness onReport={onReport} />)
    type('nico')
    expect(onReport).toHaveBeenLastCalledWith('nico', undefined)
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('flags a malformed value once the field has been blurred', () => {
    render(<Harness initial="nico" />)
    fireEvent.blur(field())
    expect(field()).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps flagging live after the first blur', () => {
    const onReport = vi.fn()
    render(<Harness onReport={onReport} />)
    fireEvent.blur(field())
    type('nico:1220df94')
    expect(onReport).toHaveBeenLastCalledWith('nico:1220df94', 'missing-separator')
    expect(field()).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears the flag as soon as the value becomes well-formed', () => {
    render(<Harness initial="nico" />)
    fireEvent.blur(field())
    type(VALID)
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('never flags an empty field', () => {
    const onReport = vi.fn()
    render(<Harness initial="nico" onReport={onReport} />)
    fireEvent.blur(field())
    type('')
    expect(onReport).toHaveBeenLastCalledWith('', undefined)
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('still calls a consumer onBlur', () => {
    const onBlur = vi.fn()
    render(<Harness onBlur={onBlur} />)
    fireEvent.blur(field())
    expect(onBlur).toHaveBeenCalledOnce()
  })

  it('turns off the autocorrect a party id has no use for', () => {
    render(<Harness />)
    expect(field()).toHaveAttribute('spellcheck', 'false')
    expect(field()).toHaveAttribute('autocapitalize', 'off')
    expect(field()).toHaveAttribute('autocomplete', 'off')
  })
})
