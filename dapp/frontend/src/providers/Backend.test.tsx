import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Deployment, LedgerApi } from '@/backend/config'

const loadBackendConfig = vi.hoisted(() => vi.fn())
const ledgerApi = vi.hoisted(() => ({ current: (() => undefined) as unknown as LedgerApi }))

vi.mock('@/backend/config', () => ({ loadBackendConfig }))
vi.mock('@/backend/LedgerBackend', () => ({ LedgerBackend: class {} }))
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => 'ok' }))
vi.mock('@bootnodedev/canton-connect', () => ({
  useExecute: () => ({ execute: () => undefined }),
  useLedger: () => ({ ledgerApi: ledgerApi.current }),
  useParty: () => ({ party: { partyId: 'party::1' } }),
}))

const { Backend, useBackend } = await import('@/providers/Backend')

const DEPLOYMENT = { pkg: 'pkg' } as unknown as Deployment
const BOOTSTRAP = 'No factory found on the ledger.'

const roots: { unmount: () => void }[] = []

const mount = (seen: (string | undefined)[]): (() => Promise<void>) => {
  const Probe = (): null => {
    seen.push(useBackend().configError)
    return null
  }
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  return async () => {
    await act(async () => {
      root.render(
        <Backend>
          <Probe />
        </Backend>,
      )
    })
  }
}

describe('Backend', () => {
  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots.length = 0
    vi.clearAllMocks()
  })

  it('drops the config error once a later load succeeds', async () => {
    loadBackendConfig.mockRejectedValueOnce(new Error(BOOTSTRAP))
    const seen: (string | undefined)[] = []
    const render = mount(seen)
    await render()

    expect(seen.at(-1)).toContain(BOOTSTRAP)

    loadBackendConfig.mockResolvedValueOnce(DEPLOYMENT)
    ledgerApi.current = (() => undefined) as unknown as LedgerApi
    await render()

    expect(seen.at(-1)).toBeUndefined()
  })
})
