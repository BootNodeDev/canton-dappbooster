import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, SESSION_COOKIE } from '#server/app'
import { type Db, openDb } from '#server/auth/db'
import { testDb } from '#server/db/testDb'
import type { ExecuteParams, LedgerApiParams } from '#server/ledger/wallet'

vi.mock('#server/ledger/transferContext', () => ({
  fetchTransferContext: async () => ({
    ctx: { amuletRules: 'rules', featuredAppRight: null, openMiningRound: 'round' },
    disclosed: [],
    rulesTemplateId: 'amuletpkg:Splice.AmuletRules:AmuletRules',
  }),
}))

type Call = { as: string; execute?: ExecuteParams; read?: LedgerApiParams }

const setup = async (patchDb: (db: Db) => Db = (db) => db) => {
  const calls: Call[] = []
  const app = createApp({
    db: patchDb(openDb(await testDb())),
    deployment: async () => ({
      factoryBlob: 'blob',
      factoryCid: 'factory',
      pkg: 'pkg1',
      synchronizerId: 'sync::1',
    }),
    ledgerFor: (user) => ({
      execute: async (params) => {
        calls.push({ as: user.ledgerUserId, execute: params })
        return {}
      },
      ledgerApi: async (params) => {
        calls.push({ as: user.ledgerUserId, read: params })
        return params.resource === '/v2/state/ledger-end' ? { offset: 1 } : []
      },
    }),
    provision: async (username) => ({
      ledgerUserId: `wl-${username}`,
      partyId: `wl-${username}::fp`,
    }),
  })
  return { app, calls }
}

const post = (path: string, body: unknown, cookie?: string) =>
  new Request(`http://app${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })

const cookieOf = (response: Response): string => {
  const set = response.headers.get('set-cookie') ?? ''
  const match = set.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (match === null) throw new Error(`no session cookie in ${set}`)
  return `${SESSION_COOKIE}=${match[1]}`
}

const signup = async (app: Env['app'], username: string) => {
  const response = await app.request(post('/api/auth/signup', { username, password: 'hunter22!' }))
  expect(response.status).toBe(201)
  return cookieOf(response)
}

type Env = Awaited<ReturnType<typeof setup>>

let env: Env

beforeEach(async () => {
  env = await setup()
})

describe('auth', () => {
  it('signs up into a session that reports the provisioned party', async () => {
    const cookie = await signup(env.app, 'Alice')
    const response = await env.app.request('/api/session', { headers: { cookie } })
    expect(await response.json()).toEqual({ username: 'alice', partyId: 'wl-alice::fp' })
  })

  it('refuses a taken username, a weak password and a malformed one', async () => {
    await signup(env.app, 'alice')
    const again = await env.app.request(
      post('/api/auth/signup', { username: 'alice', password: 'hunter22!' }),
    )
    expect(again.status).toBe(409)
    const weak = await env.app.request(
      post('/api/auth/signup', { username: 'bob', password: 'short' }),
    )
    expect(weak.status).toBe(400)
    const odd = await env.app.request(
      post('/api/auth/signup', { username: '-bob', password: 'hunter22!' }),
    )
    expect(odd.status).toBe(400)
  })

  it('answers 409 when the name is taken between the check and the insert', async () => {
    const racy = await setup((db) => ({ ...db, userByUsername: async () => undefined }))
    await signup(racy.app, 'alice')
    const again = await racy.app.request(
      post('/api/auth/signup', { username: 'alice', password: 'hunter22!' }),
    )
    expect(again.status).toBe(409)
  })

  it('reports a failed account write as a failure, not as a taken name', async () => {
    const broken = await setup((db) => ({
      ...db,
      createUser: async () => {
        throw new Error('connection reset')
      },
    }))
    const response = await broken.app.request(
      post('/api/auth/signup', { username: 'alice', password: 'hunter22!' }),
    )
    expect(response.status).toBe(502)
  })

  it('logs in with the right password only, and logs out for good', async () => {
    await signup(env.app, 'alice')
    const wrong = await env.app.request(
      post('/api/auth/login', { username: 'alice', password: 'nope-nope' }),
    )
    expect(wrong.status).toBe(401)
    const unknown = await env.app.request(
      post('/api/auth/login', { username: 'mallory', password: 'hunter22!' }),
    )
    expect(unknown.status).toBe(401)

    const right = await env.app.request(
      post('/api/auth/login', { username: 'alice', password: 'hunter22!' }),
    )
    expect(right.status).toBe(200)
    const cookie = cookieOf(right)
    await env.app.request(post('/api/auth/logout', {}, cookie))
    expect((await env.app.request('/api/session', { headers: { cookie } })).status).toBe(401)
  })

  it('stops answering login guesses after a handful', async () => {
    await signup(env.app, 'alice')
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) {
      const response = await env.app.request(
        post('/api/auth/login', { username: 'alice', password: 'guess-guess' }),
      )
      statuses.push(response.status)
    }
    expect(statuses.at(-1)).toBe(429)
  })

  it('answers 401 to every ledger route without a session', async () => {
    for (const path of ['/api/vesting', '/api/balance', '/api/session']) {
      expect((await env.app.request(path)).status).toBe(401)
    }
    expect((await env.app.request(post('/api/tap', {}))).status).toBe(401)
  })

  it('refuses a write that is not JSON, which is what a cross-site form would send', async () => {
    const cookie = await signup(env.app, 'alice')
    const response = await env.app.request('/api/tap', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'x=1',
    })
    expect(response.status).toBe(415)
  })
})

describe('acting party', () => {
  it('reads as the session user, under that user’s own ledger token', async () => {
    const cookie = await signup(env.app, 'alice')
    await env.app.request('/api/vesting', { headers: { cookie } })
    const reads = env.calls.filter((call) => call.read?.resource === '/v2/state/active-contracts')
    expect(reads.length).toBeGreaterThan(0)
    for (const call of reads) {
      expect(call.as).toBe('wl-alice')
      const body = call.read?.body as { filter: { filtersByParty: Record<string, unknown> } }
      expect(Object.keys(body.filter.filtersByParty)).toEqual(['wl-alice::fp'])
    }
  })

  it('submits as the session party whatever the body claims', async () => {
    await signup(env.app, 'bob')
    const cookie = await signup(env.app, 'alice')
    const response = await env.app.request(
      post('/api/tap', { partyId: 'wl-bob::fp', receiver: 'wl-bob::fp' }, cookie),
    )
    expect(response.status).toBe(200)
    const [submission] = env.calls.filter((call) => call.execute !== undefined)
    expect(submission?.as).toBe('wl-alice')
    expect(submission?.execute?.actAs).toEqual(['wl-alice::fp'])
    expect(submission?.execute?.commands[0]?.ExerciseCommand.choiceArgument.receiver).toBe(
      'wl-alice::fp',
    )
  })

  it('rejects a grant with a malformed body before touching the ledger', async () => {
    const cookie = await signup(env.app, 'alice')
    const response = await env.app.request(
      post('/api/grants', { receiver: 'bob', totalAmount: '1', title: 't' }, cookie),
    )
    expect(response.status).toBe(400)
    expect(env.calls.filter((call) => call.execute !== undefined)).toEqual([])
  })

  it('rejects a schedule the ledger could not encode before splitting anything', async () => {
    const cookie = await signup(env.app, 'alice')
    for (const schedule of [{}, { cliff: 'x', curve: { kind: 'milestone' } }, 'linear']) {
      const response = await env.app.request(
        post(
          '/api/grants',
          { receiver: 'wl-bob::fp', totalAmount: '1', title: 't', schedule },
          cookie,
        ),
      )
      expect(response.status).toBe(400)
    }
    expect(env.calls.filter((call) => call.execute !== undefined)).toEqual([])
  })

  it('rejects an amount that is not a positive figure', async () => {
    const cookie = await signup(env.app, 'alice')
    for (const amount of ['.', '0', '0.0', '-1', '']) {
      const response = await env.app.request(post('/api/grants/g1/withdraw', { amount }, cookie))
      expect(response.status).toBe(400)
    }
    expect(env.calls.filter((call) => call.execute !== undefined)).toEqual([])
  })

  it('resolves a username to the party a grant can name', async () => {
    await signup(env.app, 'bob')
    const cookie = await signup(env.app, 'alice')
    const found = await env.app.request('/api/users/Bob', { headers: { cookie } })
    expect(await found.json()).toEqual({ username: 'bob', partyId: 'wl-bob::fp' })
    expect((await env.app.request('/api/users/nobody', { headers: { cookie } })).status).toBe(404)
  })
})
