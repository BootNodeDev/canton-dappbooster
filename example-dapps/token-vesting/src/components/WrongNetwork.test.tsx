import type { Account } from '@bootnodedev/canton-connect'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackendState } from '@/providers/Backend'

const state = vi.hoisted(() => ({
  account: undefined as Account | undefined,
  networkStatus: undefined as BackendState['networkStatus'],
}))

vi.mock('@bootnodedev/canton-connect', () => ({ useAccount: () => ({ account: state.account }) }))
vi.mock('@/providers/Backend', () => ({
  useBackend: () => ({ networkStatus: state.networkStatus }) as BackendState,
}))

const { WrongNetwork } = await import('@/components/WrongNetwork')

const ACCOUNT: Account = {
  hint: 'alice',
  namespace: '1',
  networkId: 'canton:localnet',
  partyId: 'party::1',
  primary: true,
  publicKey: 'key',
  signingProviderId: 'test',
  status: 'allocated',
}

const roots: { unmount: () => void }[] = []

const render = async (
  networkStatus: BackendState['networkStatus'],
  account: Account | undefined,
): Promise<HTMLElement> => {
  state.networkStatus = networkStatus
  state.account = account
  const container = document.createElement('div')
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<WrongNetwork />)
  })
  return container
}

describe('WrongNetwork', () => {
  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots.length = 0
  })

  it('names the wallet network when it cannot reach the app', async () => {
    const container = await render('wrong', ACCOUNT)

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('localnet')
  })

  it('says so when the check could not answer', async () => {
    const container = await render('unknown', ACCOUNT)

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Cannot determine network',
    )
  })

  it.each([
    ['the network is fine', 'ok' as const, ACCOUNT],
    ['the check has not answered', undefined, ACCOUNT],
    ['no wallet is connected', 'unknown' as const, undefined],
  ])('renders nothing when %s', async (_case, networkStatus, account) => {
    const container = await render(networkStatus, account)

    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
