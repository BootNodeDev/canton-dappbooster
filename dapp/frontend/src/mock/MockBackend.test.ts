import { describe, expect, it } from 'vitest'
import type { VestingView } from '@/backend/VestingBackend'
import type { VestingSchedule } from '@/lib/schedule'
import type { Grant, Proposal, VestedClaim } from '@/store/types'
import { MockBackend } from './MockBackend'

const OP = 'operator::mock'
const ALICE = 'alice::mock' // funder / proposer
const BOB = 'bob::mock' // receiver
const CAROL = 'carol::mock'

// A schedule entirely in the past → vested fraction is 1 at any current time,
// so cancel/withdraw math is deterministic regardless of the wall clock.
const pastSchedule: VestingSchedule = {
  cliff: '2020-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2020-01-01T00:00:00Z', end: '2021-01-01T00:00:00Z' },
}

const grant = (over: Partial<Grant> = {}): Grant => ({
  id: 'g1',
  title: 'Grant',
  provider: OP,
  creator: ALICE,
  receiver: BOB,
  totalAmount: 1000,
  schedule: pastSchedule,
  alreadyWithdrawn: 0,
  ...over,
})

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: 'p1',
  title: 'Proposal',
  provider: OP,
  proposer: ALICE,
  receiver: BOB,
  totalAmount: 500,
  schedule: pastSchedule,
  ...over,
})

const claim = (over: Partial<VestedClaim> = {}): VestedClaim => ({
  id: 'r1',
  title: 'Residual',
  provider: OP,
  creator: ALICE,
  receiver: BOB,
  amount: 200,
  withdrawn: 0,
  ...over,
})

const view = (over: Partial<VestingView> = {}): VestingView => ({
  grants: [],
  proposals: [],
  claims: [],
  ...over,
})

describe('MockBackend', () => {
  it('is always available', async () => {
    await expect(new MockBackend(view()).isAvailable()).resolves.toBe(true)
  })

  it('viewAs returns only the contracts the party is a stakeholder of', async () => {
    const backend = new MockBackend(
      view({
        grants: [grant({ id: 'g1' })],
        proposals: [proposal({ id: 'p1', proposer: ALICE, receiver: CAROL })],
      }),
    )
    const bob = await backend.viewAs(BOB)
    expect(bob.grants.map((g) => g.id)).toEqual(['g1'])
    expect(bob.proposals).toEqual([]) // Carol's proposal is not visible to Bob

    const alice = await backend.viewAs(ALICE)
    expect(alice.proposals.map((p) => p.id)).toEqual(['p1'])
  })

  it('createVesting adds a proposal visible to both proposer and receiver', async () => {
    const backend = new MockBackend(view())
    const result = await backend.createVesting({
      proposer: ALICE,
      receiver: BOB,
      totalAmount: 750,
      schedule: pastSchedule,
      title: 'New grant',
      note: 'welcome',
    })
    expect(result.disclosedBytes).toBeGreaterThan(0)

    const bob = await backend.viewAs(BOB)
    expect(bob.proposals).toHaveLength(1)
    expect(bob.proposals[0]).toMatchObject({
      proposer: ALICE,
      receiver: BOB,
      totalAmount: 750,
      title: 'New grant',
      note: 'welcome',
    })
  })

  it('accept turns the proposal into a fresh grant and drops the proposal', async () => {
    const backend = new MockBackend(view({ proposals: [proposal({ id: 'p1', totalAmount: 500 })] }))
    await backend.accept({ receiver: BOB, proposalCid: 'p1' })

    const bob = await backend.viewAs(BOB)
    expect(bob.proposals).toEqual([])
    expect(bob.grants).toHaveLength(1)
    expect(bob.grants[0]).toMatchObject({ receiver: BOB, totalAmount: 500, alreadyWithdrawn: 0 })
  })

  it('withdraw increases the grant already-withdrawn amount', async () => {
    const backend = new MockBackend(
      view({ grants: [grant({ id: 'g1', totalAmount: 1000, alreadyWithdrawn: 100 })] }),
    )
    await backend.withdraw({ receiver: BOB, contractCid: 'g1', amount: 250 })

    const bob = await backend.viewAs(BOB)
    expect(bob.grants[0].alreadyWithdrawn).toBe(350)
  })

  it('withdraw rejects an amount past the vested, unclaimed balance', async () => {
    // Fully-past schedule → vested = 1000; withdrawn 100 → claimable 900.
    const backend = new MockBackend(
      view({ grants: [grant({ id: 'g1', totalAmount: 1000, alreadyWithdrawn: 100 })] }),
    )
    await expect(
      backend.withdraw({ receiver: BOB, contractCid: 'g1', amount: 950 }),
    ).rejects.toThrow(/exceeds/)

    const bob = await backend.viewAs(BOB)
    expect(bob.grants[0].alreadyWithdrawn).toBe(100) // unchanged
  })

  it('createVesting rejects a total below the minimum', async () => {
    const backend = new MockBackend(view())
    await expect(
      backend.createVesting({
        proposer: ALICE,
        receiver: BOB,
        totalAmount: 0.5,
        schedule: pastSchedule,
        title: 'Too small',
      }),
    ).rejects.toThrow(/at least/)
    expect((await backend.viewAs(BOB)).proposals).toEqual([])
  })

  it('claimResidual rejects a withdrawal past the residual balance', async () => {
    const backend = new MockBackend(
      view({ claims: [claim({ id: 'r1', amount: 200, withdrawn: 50 })] }),
    )
    await expect(
      backend.claimResidual({ receiver: BOB, claimCid: 'r1', amount: 200 }),
    ).rejects.toThrow(/exceeds/)
    expect((await backend.viewAs(BOB)).claims[0].withdrawn).toBe(50) // unchanged
  })

  it('cancel removes the grant and leaves the receiver a residual claim for the unwithdrawn vested amount', async () => {
    // Fully-past schedule → vested = total = 1000; withdrawn 400 → residual 600.
    const backend = new MockBackend(
      view({ grants: [grant({ id: 'g1', totalAmount: 1000, alreadyWithdrawn: 400 })] }),
    )
    await backend.cancel({ creator: ALICE, contractCid: 'g1' })

    const bob = await backend.viewAs(BOB)
    expect(bob.grants).toEqual([])
    expect(bob.claims).toHaveLength(1)
    expect(bob.claims[0]).toMatchObject({ receiver: BOB, amount: 600, withdrawn: 0 })
  })

  it('claimResidual increases withdrawn and clears a fully-withdrawn claim', async () => {
    const backend = new MockBackend(
      view({ claims: [claim({ id: 'r1', amount: 200, withdrawn: 0 })] }),
    )
    await backend.claimResidual({ receiver: BOB, claimCid: 'r1', amount: 50 })
    let bob = await backend.viewAs(BOB)
    expect(bob.claims[0].withdrawn).toBe(50)

    await backend.claimResidual({ receiver: BOB, claimCid: 'r1', amount: 150 })
    bob = await backend.viewAs(BOB)
    expect(bob.claims).toEqual([])
  })
})
