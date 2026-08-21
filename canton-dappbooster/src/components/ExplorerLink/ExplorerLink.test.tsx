import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExplorerLink } from '#src/components/ExplorerLink'
import { anatomy } from '#src/components/ExplorerLink/anatomy'

const HREF = 'https://scan.example/party/nico'
const LABEL = 'View party id in explorer'

describe('ExplorerLink', () => {
  it('renders a link carrying the root part and the href', () => {
    render(<ExplorerLink aria-label={LABEL} href={HREF} />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass(anatomy.parts.root)
    expect(link).toHaveAttribute('href', HREF)
  })

  it('appends a consumer class to the root part', () => {
    render(<ExplorerLink aria-label={LABEL} className="extra" href={HREF} />)
    expect(screen.getByRole('link')).toHaveClass(anatomy.parts.root, 'extra')
  })

  // The types bar a consumer from setting either, so this pins the runtime behind them too.
  it('opens in a new tab without handing over the opener, whatever the consumer passes', () => {
    const unsafe = { rel: 'opener', target: '_self' } as Record<string, string>
    render(<ExplorerLink aria-label={LABEL} href={HREF} {...unsafe} />)
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // The icon is aria-hidden, so the required label is the only accessible name the link has.
  it('takes its accessible name from the consumer', () => {
    render(<ExplorerLink aria-label={LABEL} href={HREF} />)
    expect(screen.getByRole('link', { name: LABEL })).toBeInTheDocument()
  })

  it('forwards unknown props to the link', () => {
    render(<ExplorerLink aria-label={LABEL} data-testid="explorer" href={HREF} />)
    expect(screen.getByRole('link')).toHaveAttribute('data-testid', 'explorer')
  })
})
