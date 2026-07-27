import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('@bootnodedev/canton-dappbooster stack smoke test', () => {
  it('renders through the vitest + jsdom + testing-library stack', () => {
    render(<span>canton-dappbooster</span>)
    expect(screen.getByText('canton-dappbooster')).toBeInTheDocument()
  })
})
