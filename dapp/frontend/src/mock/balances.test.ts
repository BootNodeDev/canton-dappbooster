import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sumHoldings } from '@/hooks/useTokenBalance'
import { readHoldings } from '@/mock/balances'
import { MOCK_PARTIES } from '@/mock/seed'

const read = async (partyId: string): Promise<Awaited<ReturnType<typeof readHoldings>>> => {
  const pending = readHoldings(partyId)
  await vi.advanceTimersByTimeAsync(400)
  return pending
}

describe('readHoldings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('answers every party the picker offers with its own funded balance', async () => {
    const totals = await Promise.all(
      MOCK_PARTIES.map(async ({ partyId }) => {
        const holdings = await read(partyId)
        expect(holdings).toBeDefined()
        return sumHoldings(holdings ?? [])
      }),
    )
    expect(totals.every((total) => total !== '0')).toBe(true)
    expect(new Set(totals).size).toBe(totals.length)
  })

  it('reads a party with no record as no record, not as an empty wallet', async () => {
    await expect(read('nobody::1220deadbeef')).resolves.toBeUndefined()
  })
})
