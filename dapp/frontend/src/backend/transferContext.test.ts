import { describe, expect, it, vi } from 'vitest'
import { fetchTransferContext } from '@/backend/transferContext'

const disclosure = (templateId: string, contractId: string): Record<string, unknown> => ({
  templateId,
  contractId,
  createdEventBlob: `blob-${contractId}`,
  synchronizerId: 'global-domain::1220',
})

const RULES = disclosure('rulespkg:Splice.AmuletRules:AmuletRules', 'rules-cid')
const ROUND = disclosure('roundpkg:Splice.Round:OpenMiningRound', 'round-2')

// The whole of the tap answer, of which only the disclosures are kept: the command it builds is
// what makes this a build-and-discard rather than a mint.
const stubTap = (disclosedContracts: unknown[]): { calls: unknown[] } => {
  const calls: unknown[] = []
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body))
    return {
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: '1',
        result: { commands: { ExerciseCommand: {} }, disclosedContracts },
      }),
    }
  })
  return { calls }
}

describe('fetchTransferContext', () => {
  it('keeps the AmuletRules and open mining round disclosures and drops the rest', async () => {
    stubTap([
      RULES,
      ROUND,
      disclosure('roundpkg:Splice.ExternalPartyConfigState:ExternalPartyConfigState', 'cfg'),
    ])

    const { ctx, disclosed, rulesTemplateId } = await fetchTransferContext('funder::1')

    expect(ctx).toEqual({
      amuletRules: 'rules-cid',
      openMiningRound: 'round-2',
      featuredAppRight: null,
    })
    expect(disclosed).toEqual([
      {
        templateId: 'rulespkg:Splice.AmuletRules:AmuletRules',
        contractId: 'rules-cid',
        createdEventBlob: 'blob-rules-cid',
      },
      {
        templateId: 'roundpkg:Splice.Round:OpenMiningRound',
        contractId: 'round-2',
        createdEventBlob: 'blob-round-2',
      },
    ])
    // The split exercises AmuletRules directly, so it needs the resolved id the filters do not use.
    expect(rulesTemplateId).toBe('rulespkg:Splice.AmuletRules:AmuletRules')
  })

  // The url itself is the build's, so only the request is asserted on here.
  it('asks for a tap to the connected party', async () => {
    const { calls } = stubTap([RULES, ROUND])

    await fetchTransferContext('funder::1')

    expect(calls).toEqual([
      {
        jsonrpc: '2.0',
        id: '1',
        method: 'amulet.tap',
        params: { receiver: 'funder::1' },
      },
    ])
  })

  it('rejects when either disclosure is missing', async () => {
    stubTap([RULES])

    await expect(fetchTransferContext('funder::1')).rejects.toThrow(/disclosed no AmuletRules/)
  })

  // A refusal is a 200 carrying `error`, which would otherwise read as an empty disclosure list.
  it('surfaces a JSON-RPC error rather than treating the answer as a result', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: '1',
        error: { code: -32601, message: 'Method not forwarded: amulet.tap' },
      }),
    }))

    await expect(fetchTransferContext('funder::1')).rejects.toThrow(/Method not forwarded/)
  })

  it('names the status rather than letting an html error page fail as a parse error', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }))

    await expect(fetchTransferContext('funder::1')).rejects.toThrow(
      /wallet-service answered 502 for amulet.tap/,
    )
  })
})
