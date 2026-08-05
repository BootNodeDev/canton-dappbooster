import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExplorerLink } from '.'
import { anatomy } from './anatomy'

const HREF = 'https://scan.example/party/nico'

describe('ExplorerLink', () => {
  it('renders a link carrying the root part and the href', () => {
    render(<ExplorerLink href={HREF} />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass(anatomy.parts.root)
    expect(link).toHaveAttribute('href', HREF)
  })

  it('appends a consumer class to the root part', () => {
    render(<ExplorerLink href={HREF} className="extra" />)
    expect(screen.getByRole('link')).toHaveClass(anatomy.parts.root, 'extra')
  })

  it('opens in a new tab without handing over the opener', () => {
    render(<ExplorerLink href={HREF} />)
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // The icon is aria-hidden, so the consumer's label is the only accessible name the link has.
  it('takes its accessible name from the consumer', () => {
    render(<ExplorerLink href={HREF} aria-label="View party id in explorer" />)
    expect(screen.getByRole('link', { name: 'View party id in explorer' })).toBeInTheDocument()
  })

  it('forwards unknown props to the link', () => {
    render(<ExplorerLink href={HREF} data-testid="explorer" />)
    expect(screen.getByRole('link')).toHaveAttribute('data-testid', 'explorer')
  })
})
