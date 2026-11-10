import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, onSessionExpired } from '@/backend/api'
import { vesting } from '@/backend/vesting'

type Sent = { body?: unknown; headers?: HeadersInit; method?: string; url: string }

const stubFetch = (status = 200, payload: unknown = { ok: true }): Sent[] => {
  const sent: Sent[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    sent.push({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    })
    return new Response(JSON.stringify(payload), { status })
  })
  return sent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('vesting', () => {
  it('posts JSON to the route each write names, ids escaped', async () => {
    const sent = stubFetch()

    await vesting.createVesting({
      receiver: 'bob::1',
      totalAmount: '10',
      schedule: { cliff: '2026-01-01T00:00:00Z', curve: { kind: 'milestone', points: [] } },
      title: 'Grant',
    })
    await vesting.withdraw('c/1', '2')
    await vesting.tap()

    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'POST /api/grants',
      'POST /api/grants/c%2F1/withdraw',
      'POST /api/tap',
    ])
    expect(sent[1]?.body).toEqual({ amount: '2' })
    expect(sent[0]?.headers).toEqual({ 'content-type': 'application/json' })
  })

  it('reads the free balance out of its envelope', async () => {
    stubFetch(200, { free: '42.5' })
    expect(await vesting.balance()).toBe('42.5')
  })

  it('throws the server’s own message, with its status', async () => {
    stubFetch(502, { error: 'only 3 AMT is free to fund this grant' })
    const failure = vesting.tap()
    await expect(failure).rejects.toThrow('only 3 AMT is free to fund this grant')
    await expect(failure).rejects.toBeInstanceOf(ApiError)
  })

  it('tells session listeners when a call finds the session gone', async () => {
    stubFetch(401, { error: 'not signed in' })
    const expired = vi.fn()
    const stop = onSessionExpired(expired)
    await expect(vesting.view()).rejects.toThrow('not signed in')
    stop()
    expect(expired).toHaveBeenCalledOnce()
  })
})
