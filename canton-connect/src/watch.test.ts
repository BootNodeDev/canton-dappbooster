import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollEvery } from '#src/watch'

describe('pollEvery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks once per interval until torn down', () => {
    const tick = vi.fn()
    const stop = pollEvery(1000)(tick)

    vi.advanceTimersByTime(999)
    expect(tick).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2001)
    expect(tick).toHaveBeenCalledTimes(3)

    stop()
    vi.advanceTimersByTime(5000)
    expect(tick).toHaveBeenCalledTimes(3)
  })

  it('ticks every 3 seconds unless told otherwise', () => {
    const tick = vi.fn()
    const stop = pollEvery()(tick)

    vi.advanceTimersByTime(2999)
    expect(tick).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(tick).toHaveBeenCalledTimes(1)

    stop()
  })
})
