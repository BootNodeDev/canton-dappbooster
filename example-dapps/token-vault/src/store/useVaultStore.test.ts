import { describe, expect, it, vi } from 'vitest'
import type { VaultProposal, VaultRequest, VaultRequests } from '@/backend/requests'
import type { VaultBackend } from '@/backend/VaultBackend'
import { useVaultStore } from '@/store/useVaultStore'

const request = (contractId: string): VaultRequest => ({
  allocateBefore: '2026-09-10T13:00:00Z',
  allocated: false,
  amount: '25.0',
  contractId,
  instrumentId: { admin: 'token-issuer::ns', id: 'USDX' },
  kind: 'deposit',
  requestedAt: '2026-09-10T12:00:00Z',
  settleBefore: '2026-09-10T14:00:00Z',
  spec: { settlement: {}, transferLeg: {}, transferLegId: 'deposit' },
})

const proposal: VaultProposal = { amount: '1.0', contractId: '00prop', kind: 'deposit' }

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const backendOf = (overrides: Partial<VaultBackend> = {}): VaultBackend =>
  ({
    allocate: vi.fn(async () => {}),
    cancelProposal: vi.fn(async () => {}),
    holdingsOf: async () => [],
    propose: vi.fn(async () => {}),
    requestsOf: async () => ({ proposals: [], requests: [] }),
    tap: async () => {},
    ...overrides,
  }) as VaultBackend

const raceBackend = (routes: Record<string, Promise<VaultRequests>>): VaultBackend =>
  backendOf({ requestsOf: (partyId) => routes[partyId] as Promise<VaultRequests> })

describe('useVaultStore.refresh', () => {
  it('drops a stale in-flight read so the newest refresh wins', async () => {
    const slow = deferred<VaultRequests>()
    const fast = deferred<VaultRequests>()
    const backend = raceBackend({ A: slow.promise, B: fast.promise })

    const { refresh } = useVaultStore.getState()
    const pA = refresh(backend, 'A')
    const pB = refresh(backend, 'B')

    fast.resolve({ proposals: [], requests: [request('dep-B')] })
    await pB
    expect(useVaultStore.getState().requests.map((one) => one.contractId)).toEqual(['dep-B'])

    slow.resolve({ proposals: [], requests: [request('dep-A')] })
    await pA
    expect(useVaultStore.getState().requests.map((one) => one.contractId)).toEqual(['dep-B'])
  })

  it('drops a read still in flight when the store is cleared', async () => {
    const slow = deferred<VaultRequests>()
    const backend = raceBackend({ A: slow.promise })

    const pending = useVaultStore.getState().refresh(backend, 'A')
    useVaultStore.getState().clear()

    slow.resolve({ proposals: [], requests: [request('dep-A')] })
    await pending
    expect(useVaultStore.getState().requests).toEqual([])
  })

  it('marks itself loaded once a read answers, and unloaded again on clear', async () => {
    const backend = backendOf()

    await useVaultStore.getState().refresh(backend, 'A')
    expect(useVaultStore.getState().loaded).toBe(true)

    useVaultStore.getState().clear()
    expect(useVaultStore.getState().loaded).toBe(false)
  })

  it('stays unloaded when the read fails, so nothing renders as an empty queue', async () => {
    const backend = backendOf({
      requestsOf: async () => {
        throw new Error('nope')
      },
    })

    await useVaultStore.getState().refresh(backend, 'A')

    expect(useVaultStore.getState().loaded).toBe(false)
  })

  it('reports a failed read rather than leaving the queue pending forever', async () => {
    const backend = backendOf({
      requestsOf: async () => {
        throw new Error('claims do not authorize')
      },
    })

    await useVaultStore.getState().refresh(backend, 'A')

    expect(useVaultStore.getState().error).toBe('claims do not authorize')
  })
})

describe('useVaultStore.clear', () => {
  it('drops the previous party rows and its error', () => {
    useVaultStore.setState({
      error: 'stale failure',
      proposals: [proposal],
      requests: [request('dep-1')],
    })

    useVaultStore.getState().clear()

    expect(useVaultStore.getState()).toMatchObject({
      error: undefined,
      proposals: [],
      requests: [],
    })
  })
})

describe('useVaultStore writes', () => {
  it('re-reads after every write', async () => {
    const requestsOf = vi.fn(async () => ({ proposals: [], requests: [] }))
    const backend = backendOf({ requestsOf })
    const { allocate, cancel, propose } = useVaultStore.getState()

    await propose(backend, 'A', 'deposit', '25.0')
    await propose(backend, 'A', 'withdraw', '15.0')
    await cancel(backend, 'A', proposal)
    await allocate(backend, 'A', request('dep-1'))

    expect(backend.propose).toHaveBeenCalledWith('A', 'deposit', '25.0')
    expect(backend.propose).toHaveBeenCalledWith('A', 'withdraw', '15.0')
    expect(backend.cancelProposal).toHaveBeenCalledWith('A', proposal)
    expect(backend.allocate).toHaveBeenCalledWith('A', request('dep-1'))
    expect(requestsOf).toHaveBeenCalledTimes(4)
  })

  it('leaves a failed write to the caller, with the rows untouched', async () => {
    const requestsOf = vi.fn(async () => ({ proposals: [], requests: [] }))
    const backend = backendOf({
      propose: async () => {
        throw new Error('the wallet refused')
      },
      requestsOf,
    })

    await expect(useVaultStore.getState().propose(backend, 'A', 'deposit', '25.0')).rejects.toThrow(
      'the wallet refused',
    )
    expect(requestsOf).not.toHaveBeenCalled()
  })
})
