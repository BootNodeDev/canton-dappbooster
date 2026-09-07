import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useConnect } from '#src/hooks/useConnect'
import { FakeSessionProvider } from '#src/testing/fakeSession'

describe('FakeSessionProvider', () => {
  it('forgets the connectError it was given on reset(), as the real provider does', () => {
    const failed = new Error('wallet rejected')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <FakeSessionProvider connectError={failed}>{children}</FakeSessionProvider>
    )
    const { result } = renderHook(() => useConnect(), { wrapper })

    expect(result.current.error).toBe(failed)

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeUndefined()
  })
})
