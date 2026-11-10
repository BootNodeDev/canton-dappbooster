import { describe, expect, it } from 'vitest'
import { ledgerClient, urlFor } from '#server/ledger/client'

type Sent = { body?: unknown; headers: Record<string, string>; method: string; url: string }

const recording = (status = 200, response: unknown = {}) => {
  const sent: Sent[] = []
  const fetchFn = (async (url: URL, init: RequestInit) => {
    sent.push({
      url: String(url),
      method: String(init.method),
      headers: init.headers as Record<string, string>,
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    })
    return new Response(JSON.stringify(response), { status })
  }) as typeof fetch
  return { fetchFn, sent }
}

describe('urlFor', () => {
  it('fills path placeholders escaped and appends the query', () => {
    const url = urlFor('http://ledger:1/', {
      requestMethod: 'get',
      resource: '/v2/users/{user-id}/rights',
      path: { 'user-id': 'a/b' },
      query: { limit: 5 },
    })
    expect(String(url)).toBe('http://ledger:1/v2/users/a%2Fb/rights?limit=5')
  })

  it('refuses a placeholder it was given no value for', () => {
    expect(() =>
      urlFor('http://ledger:1', { requestMethod: 'get', resource: '/v2/users/{user-id}' }),
    ).toThrow(/user-id/)
  })
})

describe('ledgerClient', () => {
  it('sends a fresh bearer token on every request', async () => {
    let minted = 0
    const { fetchFn, sent } = recording()
    const client = ledgerClient({
      baseUrl: 'http://ledger:1',
      fetch: fetchFn,
      token: () => `t${++minted}`,
    })
    await client.ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' })
    await client.ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' })
    expect(sent.map((one) => one.headers.authorization)).toEqual(['Bearer t1', 'Bearer t2'])
  })

  it('submits as its own user with a unique command id', async () => {
    const { fetchFn, sent } = recording()
    const client = ledgerClient({
      baseUrl: 'http://ledger:1',
      fetch: fetchFn,
      token: () => 't',
      userId: 'wl-alice-x',
    })
    const params = {
      actAs: ['alice::1'],
      readAs: ['alice::1'],
      commands: [],
      disclosedContracts: [],
    }
    await client.execute(params)
    await client.execute(params)
    expect(sent[0]?.url).toBe('http://ledger:1/v2/commands/submit-and-wait')
    expect(sent[0]?.body).toMatchObject({ ...params, userId: 'wl-alice-x' })
    const ids = sent.map((one) => (one.body as { commandId: string }).commandId)
    expect(new Set(ids).size).toBe(2)
  })

  it('surfaces the ledger cause of a failure', async () => {
    const { fetchFn } = recording(400, { cause: 'DAML_AUTHORIZATION_ERROR' })
    const client = ledgerClient({ baseUrl: 'http://ledger:1', fetch: fetchFn, token: () => 't' })
    await expect(
      client.ledgerApi({ requestMethod: 'post', resource: '/v2/parties', body: {} }),
    ).rejects.toThrow('POST /v2/parties failed (400): DAML_AUTHORIZATION_ERROR')
  })

  it('names the ledger it could not reach', async () => {
    const refused = (async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    }) as unknown as typeof fetch
    const client = ledgerClient({ baseUrl: 'http://ledger:1', fetch: refused, token: () => 't' })
    await expect(
      client.ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' }),
    ).rejects.toThrow('the ledger at http://ledger:1 is unreachable (ECONNREFUSED)')
  })
})
