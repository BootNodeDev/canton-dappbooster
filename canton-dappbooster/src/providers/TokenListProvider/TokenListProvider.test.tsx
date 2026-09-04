import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TokenListProvider } from '#src/providers/TokenListProvider'
import type { Token } from '#src/providers/TokenListProvider/context'
import { useTokenList } from '#src/providers/TokenListProvider/useTokenList'
import { tokenKey } from '#src/utils/tokenKey'

const CC: Token = {
  instrumentId: { admin: 'DSO::1220ab', id: 'Amulet' },
  name: 'Canton Coin',
  symbol: 'CC',
}
const USDC: Token = {
  instrumentId: { admin: 'circle::1220cd', id: 'USDC' },
  name: 'USD Coin',
  symbol: 'USDC',
}
const held = (token: Token, balance: string): Token => ({ ...token, balance })

const Probe = (): React.JSX.Element => {
  const { byKey, tokens } = useTokenList()
  return (
    <>
      <span data-testid="symbols">{tokens.map((token) => token.symbol).join(',')}</span>
      <span data-testid="looked-up">{byKey.get(tokenKey(USDC.instrumentId))?.name ?? 'none'}</span>
    </>
  )
}

const shown = (id: 'symbols' | 'looked-up'): string | null => screen.getByTestId(id).textContent

const list = (tokens: Token[]) =>
  render(
    <TokenListProvider tokens={tokens}>
      <Probe />
    </TokenListProvider>,
  )

describe('TokenListProvider', () => {
  it('supplies the tokens in the order given', () => {
    list([CC, USDC])
    expect(shown('symbols')).toBe('CC,USDC')
  })

  it('resolves a token by its instrument id', () => {
    list([CC, USDC])
    expect(shown('looked-up')).toBe('USD Coin')
  })

  it('leads with the biggest balance', () => {
    list([held(CC, '1.5'), held(USDC, '20')])
    expect(shown('symbols')).toBe('USDC,CC')
  })

  it('puts a token with no balance last, however small the balances above it', () => {
    list([CC, held(USDC, '0')])
    expect(shown('symbols')).toBe('USDC,CC')
  })

  it('compares balances as amounts rather than as strings', () => {
    list([held(CC, '9'), held(USDC, '10')])
    expect(shown('symbols')).toBe('USDC,CC')
  })

  it('throws when the hook is used without a provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/inside a <TokenListProvider>/)

    error.mockRestore()
  })
})
