import { describe, expect, it } from 'vitest'
import type { VestingBackend, VestingView } from '@/backend/VestingBackend'
import type { Grant } from '@/store/types'
import { deriveGrant, grantBacking, grantLineage, useVestingStore } from '@/store/useVestingStore'
import { toNumber } from '@/utils/amount'

const ms = (iso: string): number => new Date(iso).getTime()

// Linear grant: cliff after start, so it is locked until 2025-06-01.
const grant = (alreadyWithdrawn = '0', totalAmount = '1000'): Grant => ({
  id: 'g1',
  title: 'Test grant',
  provider: 'p::1',
  creator: 'c::1',
  receiver: 'r::1',
  totalAmount,
  alreadyWithdrawn,
  schedule: {
    cliff: '2025-06-01T00:00:00Z',
    curve: { kind: 'linear', start: '2025-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
  },
})

describe('deriveGrant', () => {
  it('reports in_cliff with nothing vested before the cliff', () => {
    const d = deriveGrant(grant(), ms('2025-03-01T00:00:00Z'))
    expect(d.fraction).toBe(0)
    expect(d.vested).toBe('0')
    expect(d.claimable).toBe('0')
    expect(d.unvested).toBe('1000')
    expect(d.status).toBe('in_cliff')
    expect(d.locked).toBe(true)
  })

  it('reports not_started past the cliff while the first milestone is ahead', () => {
    const milestoneGrant: Grant = {
      ...grant(),
      schedule: {
        cliff: '2025-06-01T00:00:00Z',
        curve: {
          kind: 'milestone',
          points: [
            { time: '2025-09-01T00:00:00Z', fraction: 0.5 },
            { time: '2025-12-01T00:00:00Z', fraction: 1 },
          ],
        },
      },
    }
    const d = deriveGrant(milestoneGrant, ms('2025-07-01T00:00:00Z'))
    expect(d.fraction).toBe(0)
    expect(d.status).toBe('not_started')
    expect(d.locked).toBe(true)
  })

  it('subtracts already-withdrawn from claimable while vesting', () => {
    // 2025-07-01 is 181/365 of the way through → 495.89 vested.
    const d = deriveGrant(grant('100'), ms('2025-07-01T00:00:00Z'))
    expect(toNumber(d.vested)).toBeCloseTo((1000 * 181) / 365, 2)
    expect(d.claimed).toBe('100')
    expect(toNumber(d.claimable)).toBeCloseTo((1000 * 181) / 365 - 100, 2)
    expect(d.status).toBe('vesting')
  })

  it('clamps claimable to zero when withdrawn exceeds vested', () => {
    const d = deriveGrant(grant('900'), ms('2025-07-01T00:00:00Z'))
    expect(d.claimable).toBe('0')
  })

  it('reports fully_vested with no unvested remainder after end', () => {
    const d = deriveGrant(grant('0'), ms('2026-02-01T00:00:00Z'))
    expect(d.fraction).toBe(1)
    expect(d.vested).toBe('1000')
    expect(d.unvested).toBe('0')
    expect(d.status).toBe('fully_vested')
  })

  it('guards a zero-total grant against division surprises', () => {
    const d = deriveGrant(grant('0', '0'), ms('2025-07-01T00:00:00Z'))
    expect(d.vested).toBe('0')
    expect(d.claimable).toBe('0')
    expect(d.unvested).toBe('0')
  })

  it('derives vested exactly equal to the total at full precision when fully vested', () => {
    // The regression the whole migration exists to prevent: a double cannot round-trip this value.
    const fullyVested = grant('0', '8421337.1234567891')
    const d = deriveGrant(fullyVested, ms('2026-02-01T00:00:00Z'))
    expect(d.vested).toBe('8421337.1234567891')
    expect(d.unvested).toBe('0')
  })
})

// The escrow still holds the unvested part, so the re-lock floor has a bigger remainder to measure
// against than the claimable slice the ceiling uses.
describe('grantBacking', () => {
  it('reports the whole escrow, not the vested slice', () => {
    const partial = grant('100')
    expect(grantBacking(partial)).toBe('900')
    expect(toNumber(grantBacking(partial))).toBeGreaterThan(
      toNumber(deriveGrant(partial, ms('2025-07-01T00:00:00Z')).claimable),
    )
  })
})

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// Backend stub whose viewAs resolution order we control, to exercise the race guard.
const raceBackend = (routes: Record<string, Promise<VestingView>>): VestingBackend =>
  ({
    viewAs: (partyId: string) => routes[partyId],
    createVesting: async () => {},
    accept: async () => {},
    withdraw: async () => {},
    cancel: async () => {},
    claimResidual: async () => {},
    claimHistory: async () => [],
  }) as unknown as VestingBackend

describe('useVestingStore.refresh', () => {
  const someGrant = (id: string): Grant => ({ ...grant(), id })

  it('drops a stale in-flight read so the newest refresh wins', async () => {
    const slow = deferred<VestingView>()
    const fast = deferred<VestingView>()
    const backend = raceBackend({ A: slow.promise, B: fast.promise })

    const { refresh } = useVestingStore.getState()
    const pA = refresh(backend, 'A') // older epoch, resolves last
    const pB = refresh(backend, 'B') // newer epoch, resolves first

    fast.resolve({ grants: [someGrant('B')], pendingGrants: [], claims: [] })
    await pB
    expect(useVestingStore.getState().grants.map((g) => g.id)).toEqual(['B'])

    slow.resolve({ grants: [someGrant('A')], pendingGrants: [], claims: [] })
    await pA
    expect(useVestingStore.getState().grants.map((g) => g.id)).toEqual(['B'])
  })

  it('drops a read still in flight when the store is cleared', async () => {
    const slow = deferred<VestingView>()
    const backend = raceBackend({ A: slow.promise })

    const pending = useVestingStore.getState().refresh(backend, 'A')
    useVestingStore.getState().clear()

    slow.resolve({ grants: [someGrant('A')], pendingGrants: [], claims: [] })
    await pending
    expect(useVestingStore.getState().grants).toEqual([])
    expect(useVestingStore.getState().loading).toBe(false)
  })
})

describe('useVestingStore.clear', () => {
  it('drops the previous party rows and its error', () => {
    useVestingStore.setState({
      grants: [grant()],
      pendingGrants: [],
      claims: [],
      error: 'stale failure',
    })

    useVestingStore.getState().clear()

    const state = useVestingStore.getState()
    expect(state.grants).toEqual([])
    expect(state.error).toBeUndefined()
  })
})

describe('grantLineage', () => {
  it('survives a claim, which is the whole point: only `claimed` moves', () => {
    expect(grantLineage(grant('0'))).toBe(grantLineage(grant('250')))
  })

  it('separates grants that differ in anything the choice preserves', () => {
    expect(grantLineage(grant('0', '1000'))).not.toBe(grantLineage(grant('0', '1001')))
    expect(grantLineage(grant())).not.toBe(grantLineage({ ...grant(), receiver: 'other::1' }))
  })
})

describe('useVestingStore.withdraw', () => {
  // The successor of the claimed grant: a new contract id, `claimed` raised, nothing else moved.
  const claimedBackend = (successorId: string): VestingBackend =>
    ({
      viewAs: async () => ({
        grants: [{ ...grant('250'), id: successorId }],
        pendingGrants: [],
        claims: [],
      }),
      withdraw: async () => {},
    }) as unknown as VestingBackend

  it('returns the successor contract id the claim created', async () => {
    useVestingStore.setState({ grants: [grant('0')] })

    const next = await useVestingStore
      .getState()
      .withdraw(claimedBackend('g2'), 'r::1', 'g1', '250')

    expect(next).toBe('g2')
  })

  it('finds the successor by lineage, which the claim leaves untouched', async () => {
    useVestingStore.setState({ grants: [grant('0')] })

    await useVestingStore.getState().withdraw(claimedBackend('g2'), 'r::1', 'g1', '250')

    expect(useVestingStore.getState().grants[0]?.id).toBe('g2')
    expect(grantLineage(grant('250'))).toBe(grantLineage(grant('0')))
  })

  it('picks the new id when an identical twin grant shares the lineage', async () => {
    const twin: Grant = { ...grant('0'), id: 'twin' }
    useVestingStore.setState({ grants: [grant('0'), twin] })
    const backend = {
      viewAs: async () => ({
        grants: [twin, { ...grant('250'), id: 'g2' }],
        pendingGrants: [],
        claims: [],
      }),
      withdraw: async () => {},
    } as unknown as VestingBackend

    const next = await useVestingStore.getState().withdraw(backend, 'r::1', 'g1', '250')

    expect(next).toBe('g2')
  })
})
