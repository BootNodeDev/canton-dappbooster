import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/ToastProvider'
import {
  getToastEntries,
  NEVER_DISMISS_MS,
  resolveDurationMs,
  subscribeToasts,
  toast,
} from '@/components/ui/toast'

describe('toast emitter', () => {
  afterEach(() => {
    toast.clear()
  })

  it('appends an entry with the requested variant', () => {
    toast.error('boom')
    const [entry] = getToastEntries()
    assert.ok(entry)
    assert.equal(entry?.variant, 'error')
    assert.equal(entry?.message, 'boom')
  })

  it('returns the entry id from each variant helper', () => {
    const id = toast.success('saved')
    assert.equal(typeof id, 'string')
    assert.equal(getToastEntries()[0]?.id, id)
  })

  it('uses the default duration for the variant when no override is supplied', () => {
    toast.info('hello')
    toast.warning('careful')
    toast.error('boom')
    const [info, warning, error] = getToastEntries()
    assert.equal(info?.durationMs, 5000)
    assert.equal(warning?.durationMs, 5000)
    assert.equal(error?.durationMs, Number.POSITIVE_INFINITY)
  })

  it('honours a custom durationMs override', () => {
    toast.warning({ message: 'careful', durationMs: 1234 })
    assert.equal(getToastEntries()[0]?.durationMs, 1234)
  })

  it('collapses repeats of the same message, replacing the previous one', () => {
    const first = toast.success('Party ID copied')
    const second = toast.success('Party ID copied')
    const successes = getToastEntries().filter((entry) => entry.variant === 'success')
    assert.equal(successes.length, 1)
    assert.notEqual(first, second)
    assert.equal(successes[0]?.id, second)
  })

  it('keeps distinct messages of the same variant', () => {
    toast.success('Party ID copied')
    toast.success('wallet-service reachable: canton-local')
    const messages = getToastEntries().map((entry) => entry.message)
    assert.deepEqual(messages, ['Party ID copied', 'wallet-service reachable: canton-local'])
  })

  it('does not collapse toasts of different variants', () => {
    toast.info('a')
    toast.success('b')
    toast.error('c')
    assert.equal(getToastEntries().length, 3)
  })

  it('evicts the oldest entry when more than three variants are active', () => {
    toast.info('a')
    toast.success('b')
    toast.warning('c')
    toast.error('d')
    const messages = getToastEntries().map((entry) => entry.message)
    assert.deepEqual(messages, ['b', 'c', 'd'])
  })

  it('dismiss removes a specific entry by id', () => {
    const idA = toast.info('a')
    toast.success('b')
    toast.dismiss(idA)
    const messages = getToastEntries().map((entry) => entry.message)
    assert.deepEqual(messages, ['b'])
  })

  it('clear empties every active entry', () => {
    toast.info('a')
    toast.success('b')
    toast.clear()
    assert.equal(getToastEntries().length, 0)
  })

  it('notifies subscribers when an entry is appended or removed', () => {
    const snapshots: number[] = []
    const unsubscribe = subscribeToasts((entries) => snapshots.push(entries.length))
    toast.info('x')
    const [entry] = getToastEntries()
    toast.dismiss(entry?.id ?? '')
    unsubscribe()
    assert.deepEqual(snapshots, [0, 1, 0])
  })
})

describe('resolveDurationMs', () => {
  it('passes finite durations through unchanged', () => {
    assert.equal(resolveDurationMs(5000), 5000)
    assert.equal(resolveDurationMs(0), 0)
  })

  it('maps POSITIVE_INFINITY to a setTimeout-safe sentinel', () => {
    const resolved = resolveDurationMs(Number.POSITIVE_INFINITY)
    assert.equal(resolved, NEVER_DISMISS_MS)
    assert.ok(resolved <= 2_147_483_647, 'must fit in a 32-bit signed integer')
  })

  it('maps NaN to the same sentinel', () => {
    assert.equal(resolveDurationMs(Number.NaN), NEVER_DISMISS_MS)
  })
})

describe('ToastProvider', () => {
  afterEach(() => {
    toast.clear()
    cleanup()
  })

  it('renders newest entries on top of the visible stack', () => {
    // The viewport portals to document.body (to escape the #root stacking context), so the toast
    // list items live under body rather than the render container.
    render(<ToastProvider>nothing</ToastProvider>)
    act(() => {
      toast.info('first')
      toast.success('second')
      toast.warning('third')
    })
    const messages = Array.from(document.body.querySelectorAll('li[data-state="open"]')).map(
      (li) => li.querySelector('div')?.textContent ?? '',
    )
    assert.deepEqual(messages, ['third', 'second', 'first'])
  })
})
