import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TokenLogo } from '.'
import { anatomy } from './anatomy'
import { swatchOf } from './swatch'

const rendered = (container: HTMLElement): HTMLElement =>
  container.querySelector(`.${anatomy.parts.root}`) as HTMLElement

describe('TokenLogo', () => {
  it('falls back to the symbol when there is no logo', () => {
    const { container } = render(<TokenLogo symbol="CC" />)
    const logo = rendered(container)
    expect(logo).toHaveTextContent('CC')
    expect(logo).toHaveAttribute(anatomy.states.fallback)
  })

  it('falls back the same way when the logo is null', () => {
    const { container } = render(<TokenLogo logo={null} symbol="CC" />)
    const logo = rendered(container)
    expect(logo).toHaveTextContent('CC')
    expect(logo).toHaveAttribute(anatomy.states.fallback)
  })

  // The disc is a fixed 2rem, so a longer symbol would be clipped mid-glyph rather than shortened.
  it('cuts a symbol too long for the disc down to its initials', () => {
    const { container } = render(<TokenLogo symbol="WSTETH" />)
    expect(rendered(container)).toHaveTextContent(/^WST$/)
  })

  it('names the palette entry the theme paints the fallback with', () => {
    const { container } = render(<TokenLogo symbol="USDC" />)
    expect(rendered(container)).toHaveAttribute(anatomy.states.swatch, String(swatchOf('USDC')))
  })

  it('renders the logo it is given and leaves the fallback unmarked', () => {
    const { container } = render(<TokenLogo logo={<svg data-testid="mark" />} symbol="USDC" />)
    const logo = rendered(container)
    expect(screen.getByTestId('mark')).toBeInTheDocument()
    expect(logo).not.toHaveAttribute(anatomy.states.fallback)
    expect(logo).not.toHaveAttribute(anatomy.states.swatch)
  })

  it('stays out of the accessibility tree either way', () => {
    const { container } = render(<TokenLogo symbol="CC" />)
    expect(rendered(container)).toHaveAttribute('aria-hidden', 'true')
  })

  it('takes the consumer class alongside its own', () => {
    const { container } = render(<TokenLogo className="row-logo" symbol="CC" />)
    expect(rendered(container)).toHaveClass(anatomy.parts.root, 'row-logo')
  })
})
