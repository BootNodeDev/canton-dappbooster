import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Placeholder } from './Placeholder'

describe('Placeholder', () => {
  it('renders a token-styled placeholder', () => {
    render(<Placeholder />)
    expect(screen.getByText('canton-dappbooster')).toHaveClass('cnc-placeholder')
  })
})
