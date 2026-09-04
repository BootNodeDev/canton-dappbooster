import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast, useToastStore } from '@/utils/toast'

describe('toast auto-dismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the clock from the push, so a viewport remount cannot extend a toast', () => {
    toast.success('Claimed 250 AMT')
    vi.advanceTimersByTime(3199)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('keeps an error and a toast carrying an action', () => {
    toast.error('Wallet refused the submission')
    toast.info('Grant created', { action: { label: 'View', to: '/grants/g1' } })
    vi.advanceTimersByTime(60_000)
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('dismisses one by id and leaves the rest on their own clocks', () => {
    toast.success('first')
    toast.success('second')
    const first = useToastStore.getState().toasts[0]
    useToastStore.getState().dismiss(first.id)

    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['second'])
    vi.advanceTimersByTime(3200)
    expect(useToastStore.getState().toasts).toEqual([])
  })
})
