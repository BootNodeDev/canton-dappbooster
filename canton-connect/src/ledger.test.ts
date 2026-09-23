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

  it('refuses an answer the transport unwrapped to nothing, naming the route and the cause', async () => {
    const empty = vi.fn<LedgerApi>().mockResolvedValue(undefined)
    const nulled = vi.fn<LedgerApi>().mockResolvedValue(null)

    await expect(createLedger(empty).ledgerEnd()).rejects.toThrow(
      /no answer for \/v2\/state\/ledger-end .* naming its JSON-RPC result something other than "result"/,
    )
    await expect(createLedger(nulled).userRights()).rejects.toThrow(
      /no answer for \/v2\/authenticated-user/,
    )
  })

  it('names the envelope rather than the Canton floor when a page read comes back empty', async () => {
    const ledgerApi = vi.fn<LedgerApi>().mockResolvedValue(undefined)

    await expect(
      createLedger(ledgerApi).activeContracts({
        templateId: '#app:Main:Grant',
        party: 'bob::1220',
      }),
    ).rejects.toThrow('no answer for /v2/state/ledger-end')
  })

  it("turns a bare Canton payload a service's own client throws into a CantonError", async () => {
    const ledgerApi = vi.fn<LedgerApi>().mockRejectedValue(cantonRefusal)

    await expect(createLedger(ledgerApi).ledgerEnd()).rejects.toBeInstanceOf(CantonError)
  })
})
