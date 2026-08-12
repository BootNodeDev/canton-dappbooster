import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '.'
import type { Token } from './context'
import { useTokenList } from './useTokenList'

const CC: Token = { decimals: 10, id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' }
const USDC: Token = { decimals: 6, id: 'usdc', name: 'USD Coin', symbol: 'USDC' }

const Probe = (): React.JSX.Element => {
  const { byId, tokens } = useTokenList()
  return (
    <>
      <span data-testid="symbols">{tokens.map((token) => token.symbol).join(',')}</span>
      <span data-testid="looked-up">{byId.get('usdc')?.name ?? 'none'}</span>
    </>
  )
}

const shown = (id: 'symbols' | 'looked-up'): string | null => screen.getByTestId(id).textContent

describe('TokenListProvider', () => {
  it('supplies the tokens in the order given', () => {
    render(
      <TokenListProvider tokens={[CC, USDC]}>
        <Probe />
      </TokenListProvider>,
    )

    expect(shown('symbols')).toBe('CC,USDC')
  })

  it('resolves a token by id', () => {
    render(
      <TokenListProvider tokens={[CC, USDC]}>
        <Probe />
      </TokenListProvider>,
    )

    expect(shown('looked-up')).toBe('USD Coin')
  })

  it('throws when the hook is used without a provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/inside a <TokenListProvider>/)

    error.mockRestore()
  })
})
