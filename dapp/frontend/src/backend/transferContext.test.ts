import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchTransferContext } from '@/backend/transferContext'

const rules = {
  amulet_rules_update: {
    contract: {
      contract_id: 'rules-cid',
      created_event_blob: 'rules-blob',
      template_id: 'pkg:Splice.AmuletRules:AmuletRules',
      payload: { dso: 'dso::1' },
    },
  },
}

const round = (
  id: string,
  number: string,
  opensAt: string,
): { contract: Record<string, unknown> } => ({
  contract: {
    contract_id: id,
    created_event_blob: `blob-${id}`,
    template_id: 'pkg:Splice.Round:OpenMiningRound',
    payload: { opensAt, round: { number } },
  },
})

const stubScan = (openMiningRounds: Record<string, unknown>): void => {
  vi.stubGlobal('fetch', async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/amulet-rules') ? rules : { open_mining_rounds: openMiningRounds },
  }))
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
})

describe('fetchTransferContext', () => {
  it('takes the highest-numbered round that has already opened', async () => {
    stubScan({
      a: round('r1', '1', '2026-01-01T00:00:00Z'),
      b: round('r3', '3', '2027-01-01T00:00:00Z'),
      c: round('r2', '2', '2026-02-01T00:00:00Z'),
    })

    const { ctx, disclosed, dso, rulesTemplateId } = await fetchTransferContext()

    expect(ctx).toEqual({
      amuletRules: 'rules-cid',
      openMiningRound: 'r2',
      featuredAppRight: null,
    })
    expect(disclosed).toEqual([
      {
        templateId: 'pkg:Splice.AmuletRules:AmuletRules',
        contractId: 'rules-cid',
        createdEventBlob: 'rules-blob',
      },
      {
        templateId: 'pkg:Splice.Round:OpenMiningRound',
        contractId: 'r2',
        createdEventBlob: 'blob-r2',
      },
    ])
    // Both are the split's, which exercises AmuletRules itself rather than a vesting choice.
    expect(dso).toBe('dso::1')
    expect(rulesTemplateId).toBe('pkg:Splice.AmuletRules:AmuletRules')
  })

  it('says the network is still starting rather than sending a round that has not opened', async () => {
    stubScan({ a: round('r1', '1', '2027-01-01T00:00:00Z') })

    await expect(fetchTransferContext()).rejects.toThrow(/no open mining round/)
  })

  it('names the status rather than letting an nginx error page fail as a parse error', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }))

    await expect(fetchTransferContext()).rejects.toThrow(/Scan answered 502/)
  })
})
