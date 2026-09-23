import { describe, expect, it, vi } from 'vitest'
import { CantonError } from '#src/cantonError'
import { createLedger, type LedgerApi } from '#src/ledger'

const cantonRefusal = {
  code: 'PERMISSION_DENIED',
  cause: 'The provided authorization token is not sufficient',
  errorCategory: 7,
}

describe('createLedger', () => {
  it('reads as the party it is given, with no session behind it', async () => {
    const ledgerApi = vi
      .fn<LedgerApi>()
      .mockResolvedValueOnce({ offset: 4 })
      .mockResolvedValueOnce({ activeContracts: [] })

    await expect(
      createLedger(ledgerApi).activeContracts({
        templateId: '#app:Main:Grant',
        party: 'bob::1220',
      }),
    ).resolves.toEqual({ contracts: [], offset: 4 })

    expect(ledgerApi).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          eventFormat: expect.objectContaining({
            filtersByParty: { 'bob::1220': expect.anything() },
          }),
        }),
      }),
    )
  })

  it("turns a bare Canton payload a service's own client throws into a CantonError", async () => {
    const ledgerApi = vi.fn<LedgerApi>().mockRejectedValue(cantonRefusal)

    await expect(createLedger(ledgerApi).ledgerEnd()).rejects.toBeInstanceOf(CantonError)
  })
})
