import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PartyRef } from '@/hooks/useParty'
import type { BackendState } from '@/providers/Backend'

const state = vi.hoisted(() => ({
  networkStatus: undefined as BackendState['networkStatus'],
  party: undefined as PartyRef | undefined,
}))

vi.mock('@/hooks/useParty', () => ({ useParty: () => ({ party: state.party }) }))
vi.mock('@/providers/Backend', () => ({
  useBackend: () => ({ networkStatus: state.networkStatus }) as BackendState,
}))

const { WrongNetwork } = await import('@/components/WrongNetwork')

const PARTY: PartyRef = { name: 'alice', networkId: 'canton:localnet', partyId: 'party::1' }

const roots: { unmount: () => void }[] = []

const render = async (
  networkStatus: BackendState['networkStatus'],
  party: PartyRef | undefined,
): Promise<HTMLElement> => {
  state.networkStatus = networkStatus
  state.party = party
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
    const container = await render('wrong', PARTY)

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('localnet')
  })

  it('says so when the check could not answer', async () => {
    const container = await render('unknown', PARTY)

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Cannot determine network',
    )
  })

  it.each([
    ['the network is fine', 'ok' as const, PARTY],
    ['the check has not answered', undefined, PARTY],
    ['no wallet is connected', 'unknown' as const, undefined],
  ])('renders nothing when %s', async (_case, networkStatus, party) => {
    const container = await render(networkStatus, party)

    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
