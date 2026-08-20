import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '#src/providers/TokenListProvider'
import type { Token } from '#src/providers/TokenListProvider/context'
import { useTokenList } from '#src/providers/TokenListProvider/useTokenList'

const CC: Token = { id: 'canton-coin', name: 'Canton Coin', symbol: 'CC' }
const USDC: Token = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }

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
