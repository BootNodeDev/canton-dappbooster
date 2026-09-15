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
vi.mock('@/backend/transferContext', () => ({ fetchAppNetwork: () => reads.app() }))

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
