import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { anatomy } from './anatomy'
import { Placeholder } from './Placeholder'

describe('Placeholder', () => {
  it('renders with the anatomy root part class', () => {
    render(<Placeholder />)
    expect(screen.getByText('canton-dappbooster')).toHaveClass(anatomy.parts.root)
  })
})
