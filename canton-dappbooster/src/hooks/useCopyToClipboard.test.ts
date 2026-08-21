import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from '#src/hooks/useCopyToClipboard'
import { stubClipboard } from '#src/testing/clipboard'

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    stubClipboard(undefined)
  })

  it('writes the value and reports success', async () => {
    const written: string[] = []
    stubClipboard(async (value) => void written.push(value))
    const { result } = renderHook(() => useCopyToClipboard())

    let outcome: Awaited<ReturnType<typeof result.current.copy>> | undefined
    await act(async () => {
      outcome = await result.current.copy('alice::1220df94')
    })

    expect(written).toEqual(['alice::1220df94'])
    expect(outcome).toEqual({ ok: true, value: 'alice::1220df94' })
    expect(result.current.state).toBe('copied')
  })

  it('returns to idle after the reset window', async () => {
    stubClipboard(async () => undefined)
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: 500 }))

    await act(async () => {
      await result.current.copy('v')
    })
    expect(result.current.state).toBe('copied')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.state).toBe('idle')
  })

  it('reports a rejected write as an error outcome', async () => {
    const failure = new Error('denied')
    stubClipboard(() => Promise.reject(failure))
    const { result } = renderHook(() => useCopyToClipboard())

    let outcome: Awaited<ReturnType<typeof result.current.copy>> | undefined
    await act(async () => {
      outcome = await result.current.copy('v')
    })

    expect(outcome).toEqual({ ok: false, error: failure })
    expect(result.current.state).toBe('error')
  })

  it('reports a missing clipboard api as an error outcome', async () => {
    stubClipboard(undefined)
    const { result } = renderHook(() => useCopyToClipboard())

    let outcome: Awaited<ReturnType<typeof result.current.copy>> | undefined
    await act(async () => {
      outcome = await result.current.copy('v')
    })

    expect(outcome?.ok).toBe(false)
    expect(result.current.state).toBe('error')
  })

  it('clears the pending reset on unmount', async () => {
    stubClipboard(async () => undefined)
    const { result, unmount } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await result.current.copy('v')
    })
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restarts the reset window on a second copy', async () => {
    stubClipboard(async () => undefined)
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: 500 }))

    await act(async () => {
      await result.current.copy('a')
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    await act(async () => {
      await result.current.copy('b')
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })

    // The first window would have elapsed by now; the second copy pushed it out.
    expect(result.current.state).toBe('copied')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('leaves one live window when two writes overlap', async () => {
    stubClipboard(async () => undefined)
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: 500 }))

    // Both writes are in flight before either settles, so neither may orphan the other's timer.
    await act(async () => {
      await Promise.all([result.current.copy('a'), result.current.copy('b')])
    })
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current.state).toBe('copied')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.state).toBe('idle')
  })

  it('schedules nothing when the write settles after unmount', async () => {
    stubClipboard(async () => undefined)
    const { result, unmount } = renderHook(() => useCopyToClipboard())

    const pending = result.current.copy('v')
    unmount()
    await act(async () => {
      await pending
    })

    expect(vi.getTimerCount()).toBe(0)
  })
})
