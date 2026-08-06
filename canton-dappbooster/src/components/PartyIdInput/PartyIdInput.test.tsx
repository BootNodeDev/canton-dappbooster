import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartyIdInput } from '.'
import { anatomy } from './anatomy'

describe('PartyIdInput', () => {
  it('renders with the root part', () => {
    render(<PartyIdInput data-testid="party-id-input" />)
    expect(screen.getByTestId('party-id-input')).toHaveClass(anatomy.parts.root)
  })

  it('appends a consumer class to the root part', () => {
    render(<PartyIdInput className="extra" data-testid="party-id-input" />)
    expect(screen.getByTestId('party-id-input')).toHaveClass(anatomy.parts.root, 'extra')
  })
})
