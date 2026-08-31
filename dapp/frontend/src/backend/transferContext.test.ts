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

// Only the disclosures and `openRound` are kept; the command tap builds is discarded.
const stubTap = (disclosedContracts: unknown[], openRound = 'round-2'): { calls: unknown[] } => {
  const calls: unknown[] = []
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body))
    return {
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: '1',
        result: {
          commands: { ExerciseCommand: { choiceArgument: { openRound } } },
          disclosedContracts,
        },
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
    // The split exercises AmuletRules directly, so it needs the resolved id the filters skip.
    expect(rulesTemplateId).toBe('rulespkg:Splice.AmuletRules:AmuletRules')
  })

  // The url is the build's, so only the request is asserted on here.
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

  // The array is the registry's, so its order decides nothing: the command names the live round.
  it('takes the round the command names rather than the first one disclosed', async () => {
    const stale = disclosure('roundpkg:Splice.Round:OpenMiningRound', 'round-1')

    stubTap([RULES, stale, ROUND], 'round-2')

    const { ctx, disclosed } = await fetchTransferContext('funder::1')

    expect(ctx.openMiningRound).toBe('round-2')
    expect(disclosed[1]?.contractId).toBe('round-2')
  })

  it('rejects when either disclosure is missing', async () => {
    stubTap([RULES])

    await expect(fetchTransferContext('funder::1')).rejects.toThrow(/disclosed no AmuletRules/)
  })

  // wallet-service refuses with a 200 carrying `error`, /api/rpc with a status and the same
  // member, so the reason survives either way.
  it.each([
    ['a 200 from wallet-service', true, 200],
    ['a 403 from the forwarding function', false, 403],
  ])('surfaces the reason behind %s', async (_case, ok, status) => {
    vi.stubGlobal('fetch', async () => ({
      ok,
      status,
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

  // A 200 carrying neither member used to throw a bare TypeError naming nothing.
  it('names the status when a 200 carries neither result nor error', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: '1' }),
    }))

    await expect(fetchTransferContext('funder::1')).rejects.toThrow(
      /wallet-service answered 200 for amulet.tap/,
    )
  })
})
