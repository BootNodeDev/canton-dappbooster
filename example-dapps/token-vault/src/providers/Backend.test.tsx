import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LedgerApi } from '@/backend/acs'
import type { Deployment } from '@/backend/deployment'

const loadDeployment = vi.hoisted(() => vi.fn())
const ledgerApi = vi.hoisted(() => ({ current: (() => undefined) as unknown as LedgerApi }))

vi.mock('@/backend/deployment', () => ({ loadDeployment }))
vi.mock('@/backend/LedgerBackend', () => ({ LedgerBackend: class {} }))
vi.mock('@bootnodedev/canton-connect', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@bootnodedev/canton-connect')>()),
  useExecute: () => ({ execute: () => undefined }),
  useLedger: () => ({ ledgerApi: ledgerApi.current }),
  useAccount: () => ({ account: { partyId: 'party::1' } }),
}))

const { Backend, useBackend } = await import('@/providers/Backend')

const DEPLOYMENT = { vault: 'vault-operator::ns' } as unknown as Deployment
const NO_VAULT = 'no vault operator on this ledger: run pnpm run bootstrap'

const roots: { unmount: () => void }[] = []

const Probe = ({ seen }: { seen: { error: string | undefined; retry: () => void }[] }): null => {
  const { deploymentError, retryDeployment } = useBackend()
  seen.push({ error: deploymentError, retry: retryDeployment })
  return null
}

const mount = async (seen: { error: string | undefined; retry: () => void }[]): Promise<void> => {
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  await act(async () => {
    root.render(
      <Backend>
        <Probe seen={seen} />
      </Backend>,
    )
  })
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

  it('drops the deployment error once a retry succeeds', async () => {
    loadDeployment.mockRejectedValueOnce(new Error(NO_VAULT))
    const seen: { error: string | undefined; retry: () => void }[] = []
    await mount(seen)

    expect(seen.at(-1)?.error).toBe(NO_VAULT)

    loadDeployment.mockResolvedValueOnce(DEPLOYMENT)
    await act(async () => {
      seen.at(-1)?.retry()
    })

    expect(seen.at(-1)?.error).toBeUndefined()
  })

  it('lets only the newest load write, so a slow failure cannot follow a fast success', async () => {
    let failSlowly: (reason: Error) => void = () => undefined
    loadDeployment.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        failSlowly = reject
      }),
    )
    const seen: { error: string | undefined; retry: () => void }[] = []
    await mount(seen)

    loadDeployment.mockResolvedValueOnce(DEPLOYMENT)
    await act(async () => {
      seen.at(-1)?.retry()
    })
    await act(async () => {
      failSlowly(new Error(NO_VAULT))
    })

    expect(seen.at(-1)?.error).toBeUndefined()
  })
})
