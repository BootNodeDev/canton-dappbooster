import { describe, expect, it } from 'vitest'
import { oauthToken } from '#server/ledger/token'

const CONFIG = {
  audience: 'https://validator.example',
  clientId: 'cid',
  clientSecret: 'shh',
  scope: 'daml_ledger_api',
  tokenUrl: 'https://auth.example/oauth/token',
}

const issuer = (expiresIn = 3600) => {
  const bodies: string[] = []
  const fetchFn = (async (_url: string, init: RequestInit) => {
    bodies.push(String(init.body))
    return new Response(
      JSON.stringify({ access_token: `t${bodies.length}`, expires_in: expiresIn }),
    )
  }) as typeof fetch
  return { bodies, fetchFn }
}

describe('oauthToken', () => {
  it('asks by client-credentials grant, with the audience', async () => {
    const { bodies, fetchFn } = issuer()
    expect(await oauthToken(CONFIG, { fetch: fetchFn })()).toBe('t1')
    expect(Object.fromEntries(new URLSearchParams(bodies[0]))).toEqual({
      grant_type: 'client_credentials',
      client_id: 'cid',
      client_secret: 'shh',
      scope: 'daml_ledger_api',
      audience: 'https://validator.example',
    })
  })

  it('keeps a token until a minute before it expires', async () => {
    const { bodies, fetchFn } = issuer(3600)
    let now = 0
    const token = oauthToken(CONFIG, { fetch: fetchFn, now: () => now })
    expect(await token()).toBe('t1')
    now = 3_539_000
    expect(await token()).toBe('t1')
    now = 3_540_000
    expect(await token()).toBe('t2')
    expect(bodies).toHaveLength(2)
  })

  it('makes one request for a burst of callers', async () => {
    const { bodies, fetchFn } = issuer()
    const token = oauthToken(CONFIG, { fetch: fetchFn })
    expect(await Promise.all([token(), token(), token()])).toEqual(['t1', 't1', 't1'])
    expect(bodies).toHaveLength(1)
  })

  it('fails on a rejection, naming the status, and asks again next time', async () => {
    let calls = 0
    const fetchFn = (async () => {
      calls += 1
      return new Response('{"error":"access_denied"}', { status: 401 })
    }) as typeof fetch
    const token = oauthToken(CONFIG, { fetch: fetchFn })
    await expect(token()).rejects.toThrow(/failed \(401\)/)
    await expect(token()).rejects.toThrow(/failed \(401\)/)
    expect(calls).toBe(2)
  })
})
