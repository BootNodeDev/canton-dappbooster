import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerApi } from '@/backend/config'

const APP = 'global-domain::12203c8fd51a9e7b2460'
const OTHER = 'global-domain::1220f4a17c9e2b6d80c3'

const reads = vi.hoisted(() => ({
  wallet: (() => Promise.resolve<string[]>([])) as () => Promise<string[]>,
  app: (() => Promise.resolve<string | undefined>(undefined)) as () => Promise<string | undefined>,
  started: 0,
}))

vi.mock('@/backend/synchronizer', () => ({
  walletSynchronizers: () => {
    reads.started += 1
    return reads.wallet()
  },
}))
vi.mock('@/backend/registry', () => ({ fetchAppNetwork: () => reads.app() }))

const { useNetworkStatus } = await import('@/hooks/useNetworkStatus')

const ledgerApi = (() => Promise.resolve(undefined)) as unknown as LedgerApi

const roots: { unmount: () => void }[] = []

const mount = (seen: (string | undefined)[]): ((networkId?: string) => Promise<void>) => {
  const Probe = ({ networkId }: { networkId: string }): null => {
    seen.push(useNetworkStatus(ledgerApi, 'party::1', networkId))
    return null
  }
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  return async (networkId = 'canton:localnet') => {
    await act(async () => {
      root.render(createElement(Probe, { networkId }))
    })
  }
}

describe('useNetworkStatus', () => {
  beforeEach(() => {
    reads.started = 0
    vi.useFakeTimers()
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots.length = 0
    vi.useRealTimers()
  })

  it('answers nothing until the first check settles', async () => {
    reads.wallet = () => new Promise(() => undefined)
    reads.app = () => new Promise(() => undefined)

    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render()

    expect(seen).toEqual([undefined])
  })

  it.each([
    ['ok', [APP]],
    ['wrong', [OTHER]],
  ])('reports %s', async (expected, wallet) => {
    reads.wallet = () => Promise.resolve(wallet)
    reads.app = () => Promise.resolve(APP)

    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render()

    expect(seen.at(-1)).toBe(expected)
  })

  it('reports unknown when the first read fails', async () => {
    reads.wallet = () => Promise.reject(new Error('down'))
    reads.app = () => Promise.reject(new Error('down'))

    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render()

    expect(seen.at(-1)).toBe('unknown')
  })

  it('keeps the last answer when a later read fails', async () => {
    let call = 0
    reads.wallet = () => {
      call += 1
      return call === 1 ? Promise.resolve([OTHER]) : Promise.reject(new Error('down'))
    }
    reads.app = () => Promise.resolve(APP)

    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000)
    })

    expect(seen.at(-1)).toBe('wrong')
  })

  it('stops reading once unmounted', async () => {
    reads.wallet = () => Promise.resolve([APP])
    reads.app = () => Promise.resolve(APP)

    const render = mount([])
    await render()

    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots.length = 0
    const onUnmount = reads.started

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })

    expect(reads.started).toBe(onUnmount)
  })

  it('drops the verdict when the wallet switches network', async () => {
    let call = 0
    reads.wallet = () => {
      call += 1
      return call === 1 ? Promise.resolve([OTHER]) : Promise.reject(new Error('down'))
    }
    reads.app = () => Promise.resolve(APP)

    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render('canton:devnet')

    expect(seen.at(-1)).toBe('wrong')

    const before = seen.length
    await render('canton:localnet')

    expect(seen.slice(before)).not.toContain('wrong')
    expect(seen.at(-1)).toBe('unknown')
  })

  it('settles the poll on an answer a later check superseded', async () => {
    let releaseFirst: ((ids: string[]) => void) | undefined
    let call = 0
    reads.wallet = () => {
      call += 1
      if (call === 1) {
        return new Promise((resolve) => {
          releaseFirst = resolve
        })
      }
      return new Promise(() => undefined)
    }
    reads.app = () => Promise.resolve(APP)

    const render = mount([])
    await render()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await act(async () => {
      releaseFirst?.([APP])
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    const armed = reads.started
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000)
    })

    expect(reads.started).toBe(armed)
  })

  it('returns to the fast retry when a definite answer regresses to unknown', async () => {
    let call = 0
    reads.wallet = () => {
      call += 1
      return Promise.resolve(call === 1 ? [APP] : [])
    }
    reads.app = () => Promise.resolve(APP)

    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000)
    })

    expect(seen.at(-1)).toBe('unknown')

    const settled = reads.started
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(reads.started - settled).toBeGreaterThan(2)
  })

  it('starts no second read while a check is already out', async () => {
    reads.wallet = () => new Promise(() => undefined)
    reads.app = () => new Promise(() => undefined)

    const render = mount([])
    await render()
    const onMount = reads.started

    for (let event = 0; event < 5; event += 1) {
      await act(async () => {
        window.dispatchEvent(new Event('focus'))
      })
    }

    expect(reads.started).toBe(onMount)
  })

  it('reads again on focus once the check in flight has answered', async () => {
    reads.wallet = () => Promise.resolve([APP])
    reads.app = () => Promise.resolve(APP)

    const render = mount([])
    await render()
    const onMount = reads.started

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(reads.started).toBe(onMount + 1)
  })

  it('reports the new network once the switch reads back', async () => {
    let call = 0
    reads.wallet = () => {
      call += 1
      return Promise.resolve(call === 1 ? [OTHER] : [APP])
    }
    reads.app = () => Promise.resolve(APP)

    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render('canton:devnet')

    expect(seen.at(-1)).toBe('wrong')

    await render('canton:localnet')

    expect(seen.at(-1)).toBe('ok')
  })
})
