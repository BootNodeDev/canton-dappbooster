import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAppNetwork, fetchTransferContext } from '@/backend/transferContext'

const PAST = '2020-01-01T00:00:00Z'
const FUTURE = '2999-01-01T00:00:00Z'

const RULES = {
  contract_id: 'rules-cid',
  created_event_blob: 'blob-rules-cid',
  template_id: 'rulespkg:Splice.AmuletRules:AmuletRules',
}

const round = (contractId: string, number: string, opensAt = PAST): Record<string, unknown> => ({
  contract: {
    contract_id: contractId,
    created_event_blob: `blob-${contractId}`,
    payload: { opensAt, round: { number } },
    template_id: 'roundpkg:Splice.Round:OpenMiningRound',
  },
})

const stubScan = (
  answers: Record<string, unknown>,
): { paths: string[]; signals: (AbortSignal | undefined)[] } => {
  const paths: string[] = []
  const signals: (AbortSignal | undefined)[] = []
  vi.stubGlobal('fetch', async (url: string, init: { signal?: AbortSignal }) => {
    const path = Object.keys(answers).find((key) => url.endsWith(key))
    if (path === undefined) {
      throw new Error(`unstubbed ${url}`)
    }
    paths.push(path)
    signals.push(init.signal)
    return { ok: true, status: 200, json: async () => answers[path] }
  })
  return { paths, signals }
}

const withRules = (rules: unknown, rounds: unknown[]): Record<string, unknown> => ({
  '/v0/amulet-rules': rules,
  '/v0/open-and-issuing-mining-rounds': {
    open_mining_rounds: Object.fromEntries(rounds.map((one, index) => [`k${index}`, one])),
  },
})

const RULES_ANSWER = { amulet_rules_update: { contract: RULES, domain_id: 'global-domain::1220' } }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchTransferContext', () => {
  it('turns the two Scan answers into the context and its disclosures', async () => {
    stubScan(withRules(RULES_ANSWER, [round('round-2', '2')]))

    const { ctx, disclosed, rulesTemplateId } = await fetchTransferContext()

    expect(ctx).toEqual({
      amuletRules: 'rules-cid',
      featuredAppRight: null,
      openMiningRound: 'round-2',
    })
    expect(disclosed).toEqual([
      {
        contractId: 'rules-cid',
        createdEventBlob: 'blob-rules-cid',
        templateId: 'rulespkg:Splice.AmuletRules:AmuletRules',
      },
      {
        contractId: 'round-2',
        createdEventBlob: 'blob-round-2',
        templateId: 'roundpkg:Splice.Round:OpenMiningRound',
      },
    ])
    expect(rulesTemplateId).toBe('rulespkg:Splice.AmuletRules:AmuletRules')
  })

  it('asks Scan for the rules and the rounds', async () => {
    const { paths } = stubScan(withRules(RULES_ANSWER, [round('round-2', '2')]))

    await fetchTransferContext()

    expect([...paths].sort()).toEqual(['/v0/amulet-rules', '/v0/open-and-issuing-mining-rounds'])
  })

  it('skips a round Scan lists that has not opened yet', async () => {
    stubScan(withRules(RULES_ANSWER, [round('round-2', '2'), round('round-3', '3', FUTURE)]))

    const { ctx } = await fetchTransferContext()

    expect(ctx.openMiningRound).toBe('round-2')
  })

  it('takes the newest open round, which closes latest, over the first listed', async () => {
    stubScan(withRules(RULES_ANSWER, [round('round-1', '1'), round('round-2', '2')]))

    const { ctx, disclosed } = await fetchTransferContext()

    expect(ctx.openMiningRound).toBe('round-2')
    expect(disclosed[1]?.contractId).toBe('round-2')
  })

  it.each([
    [
      'no round has opened',
      { amulet_rules_update: { contract: RULES } },
      [round('r', '1', FUTURE)],
    ],
    ['Scan reports no rules', {}, [round('round-2', '2')]],
  ])('rejects when %s', async (_case, rules, rounds) => {
    stubScan(withRules(rules, rounds))

    await expect(fetchTransferContext()).rejects.toThrow(/no AmuletRules and open mining round/)
  })

  it('bounds the request with a signal that is live when it is sent', async () => {
    const { signals } = stubScan(withRules(RULES_ANSWER, [round('round-2', '2')]))

    await fetchTransferContext()

    expect(signals[0]).toBeInstanceOf(AbortSignal)
    expect(signals[0]?.aborted).toBe(false)
  })

  it('names Scan when the request is aborted', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })

    await expect(fetchTransferContext()).rejects.toThrow(
      /Scan unreachable for .*: .*aborted due to timeout/,
    )
  })

  it('names the status rather than letting an html error page fail as a parse error', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 502 }))

    await expect(fetchTransferContext()).rejects.toThrow(/Scan answered 502/)
  })
})

describe('fetchAppNetwork', () => {
  it('reads the network off the AmuletRules answer', async () => {
    stubScan({ '/v0/amulet-rules': RULES_ANSWER })

    await expect(fetchAppNetwork()).resolves.toBe('global-domain::1220')
  })

  it('answers without asking for a round, so it works before the SV opens one', async () => {
    const { paths } = stubScan({ '/v0/amulet-rules': RULES_ANSWER })

    await fetchAppNetwork()

    expect(paths).toEqual(['/v0/amulet-rules'])
  })

  it('reports nothing when the answer carries no network', async () => {
    stubScan({ '/v0/amulet-rules': { amulet_rules_update: { contract: RULES } } })

    await expect(fetchAppNetwork()).resolves.toBeUndefined()
  })
})
