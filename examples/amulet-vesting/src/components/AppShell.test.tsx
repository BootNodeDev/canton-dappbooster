import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackendState } from '@/providers/Backend'

const backendState = vi.hoisted(() => ({ current: {} as BackendState }))

vi.mock('react-router-dom', () => ({
  Outlet: () => null,
  ScrollRestoration: () => null,
}))
vi.mock('@/components/CreateGrant', () => ({ CreateGrant: () => null }))
vi.mock('@/components/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/Toaster', () => ({ Toaster: () => null }))
vi.mock('@/components/TopBar', () => ({ TopBar: () => null }))
vi.mock('@/components/WrongNetwork', () => ({ WrongNetwork: () => null }))
vi.mock('@/hooks/useConnectErrorToast', () => ({ useConnectErrorToast: () => undefined }))
vi.mock('@/hooks/useCreateGrant', () => ({ useCreateGrant: () => [false, () => undefined] }))
vi.mock('@/providers/Backend', () => ({ useBackend: () => backendState.current }))

const { AppShell } = await import('@/components/AppShell')

const BOOTSTRAP = 'No factory found on the ledger. Run `pnpm run bootstrap`.'

const render = async (state: Partial<BackendState>): Promise<HTMLElement> => {
  backendState.current = {
    backend: undefined,
    configError: BOOTSTRAP,
    configPending: false,
    networkStatus: undefined,
    sessionPending: false,
    ...state,
  } as BackendState
  const container = document.createElement('div')
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<AppShell />)
  })
  return container
}

const roots: { unmount: () => void }[] = []

describe('AppShell', () => {
  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots.length = 0
  })

  it('shows the deployment error once the check reports the network is fine', async () => {
    const container = await render({ networkStatus: 'ok' })

    expect(container.querySelector('h1')?.textContent).toBe('No deployment')
    expect(container.textContent).toContain(BOOTSTRAP)
  })

  it('keeps the deployment error while the check cannot answer', async () => {
    const container = await render({ networkStatus: 'unknown' })

    expect(container.querySelector('h1')?.textContent).toBe('Undefined network')
    expect(container.textContent).toContain(BOOTSTRAP)
  })

  it('keeps the deployment error before the check has answered', async () => {
    const container = await render({ networkStatus: undefined })

    expect(container.textContent).toContain(BOOTSTRAP)
  })

  it('holds the deployment error back on the wrong network', async () => {
    const container = await render({ networkStatus: 'wrong' })

    expect(container.querySelector('h1')?.textContent).toBe('Wrong network')
    expect(container.textContent).not.toContain(BOOTSTRAP)
  })
})
