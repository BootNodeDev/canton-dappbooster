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
vi.mock('@/hooks/useCreateGrant', () => ({ useCreateGrant: () => [false, () => undefined] }))
vi.mock('@/providers/Backend', () => ({ useBackend: () => backendState.current }))
vi.mock('@/providers/Session', () => ({ useSession: () => ({ pending: false }) }))

const { AppShell } = await import('@/components/AppShell')

const BOOTSTRAP = 'No factory found on the ledger. Run `pnpm run bootstrap`.'

const render = async (state: Partial<BackendState>): Promise<HTMLElement> => {
  backendState.current = {
    ready: false,
    configError: BOOTSTRAP,
    configPending: false,
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

  it('shows the deployment error the server reports', async () => {
    const container = await render({})

    expect(container.querySelector('h1')?.textContent).toBe('No deployment')
    expect(container.textContent).toContain(BOOTSTRAP)
  })

  it('shows no error card once there is a deployment', async () => {
    const container = await render({ configError: undefined })

    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
