import { describe, expect, it } from 'vitest'
import type { Grant } from './types'
import { deriveGrant } from './useVestingStore'

const ms = (iso: string): number => new Date(iso).getTime()

// Linear grant: cliff after start, so it is locked until 2025-06-01.
const grant = (alreadyWithdrawn = 0, totalAmount = 1000): Grant => ({
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
    expect(d.vested).toBe(0)
    expect(d.claimable).toBe(0)
    expect(d.unvested).toBe(1000)
    expect(d.status).toBe('in_cliff')
  })

  it('subtracts already-withdrawn from claimable while vesting', () => {
    // 2025-07-01 is 181/365 of the way through → 495.89 vested.
    const d = deriveGrant(grant(100), ms('2025-07-01T00:00:00Z'))
    expect(d.vested).toBeCloseTo((1000 * 181) / 365, 2)
    expect(d.claimed).toBe(100)
    expect(d.claimable).toBeCloseTo((1000 * 181) / 365 - 100, 2)
    expect(d.status).toBe('vesting')
  })

  it('clamps claimable to zero when withdrawn exceeds vested', () => {
    const d = deriveGrant(grant(900), ms('2025-07-01T00:00:00Z'))
    expect(d.claimable).toBe(0)
  })

  it('reports fully_vested with no unvested remainder after end', () => {
    const d = deriveGrant(grant(0), ms('2026-02-01T00:00:00Z'))
    expect(d.fraction).toBe(1)
    expect(d.vested).toBe(1000)
    expect(d.unvested).toBe(0)
    expect(d.status).toBe('fully_vested')
  })

  it('guards a zero-total grant against division surprises', () => {
    const d = deriveGrant(grant(0, 0), ms('2025-07-01T00:00:00Z'))
    expect(d.vested).toBe(0)
    expect(d.claimable).toBe(0)
    expect(d.unvested).toBe(0)
  })
})
