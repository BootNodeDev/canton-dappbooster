import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useDisconnect } from '#src/hooks/useDisconnect'
import { FakeSessionProvider, type FakeSessionProviderProps } from '#src/testing/fakeSession'

const session = (status: FakeSessionProviderProps['status']) => ({
  wrapper: ({ children }: { children: ReactNode }) => (
    <FakeSessionProvider status={status}>{children}</FakeSessionProvider>
  ),
})

describe('useDisconnect', () => {
  it('is pending only while the machine is disconnecting', () => {
    const connected = renderHook(() => useDisconnect(), session('connected'))
    const disconnecting = renderHook(() => useDisconnect(), session('disconnecting'))

    expect(connected.result.current.isPending).toBe(false)
    expect(disconnecting.result.current.isPending).toBe(true)
  })
})
