// Underscore-prefixed because Vercel publishes every other file under `api/` as a function: named
// `registry.test.ts` this suite would deploy as a public endpoint at `/api/registry.test`.
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '#api/registry'

const INFO = '/registry/metadata/v1/info'
const INSTRUMENTS = '/registry/metadata/v1/instruments'
const FACTORY = '/registry/transfer-instruction/v1/transfer-factory'

// The rewrite carries the real path as a query parameter, so a request is spelled the way
// `vercel.json` transforms it rather than the way the browser asks for it.
const request = (path: string | undefined, init?: RequestInit): Request =>
  new Request(
    path === undefined
      ? 'https://demo.example/api/registry'
      : `https://demo.example/api/registry?path=${encodeURIComponent(path)}`,
    init,
  )

const stubUpstream = (
  reply: { status?: number; body?: string | null } = {},
): { calls: { url: string; method: string; body?: string }[] } => {
  const calls: { url: string; method: string; body?: string }[] = []
  vi.stubGlobal('fetch', async (url: string, init: { method: string; body?: string }) => {
    calls.push({ url, method: init.method, body: init.body })
    return new Response(reply.body === undefined ? '{}' : reply.body, {
      status: reply.status ?? 200,
    })
  })
  return { calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('upstream url', () => {
  it('does not double the separator when REGISTRY_URL carries a trailing slash', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example/')
    const { calls } = stubUpstream()

    await GET(request(INFO))

    expect(calls[0]?.url).toBe('https://registry.example/registry/metadata/v1/info')
  })
})

describe('the forwarded query', () => {
  it('carries pageToken through, so the instrument listing can follow its pages', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    await GET(
      new Request(
        `https://demo.example/api/registry?path=${encodeURIComponent(INSTRUMENTS)}&pageToken=abc%2Fdef`,
      ),
    )

    expect(calls[0]?.url).toBe(
      'https://registry.example/registry/metadata/v1/instruments?pageToken=abc%2Fdef',
    )
  })

  // `?pageToken=` is what a client following pages sends once there are none left to follow; relayed,
  // the registry has to resolve an empty token instead of being asked for the first page.
  it('drops a pageToken that carries no value', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    await GET(
      new Request(
        `https://demo.example/api/registry?path=${encodeURIComponent(INSTRUMENTS)}&pageToken=`,
      ),
    )

    expect(calls[0]?.url).toBe('https://registry.example/registry/metadata/v1/instruments')
  })

  it('drops a parameter it does not list, the rewrite\u2019s own path included', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    await GET(
      new Request(
        `https://demo.example/api/registry?path=${encodeURIComponent(INFO)}&admin=someone`,
      ),
    )

    expect(calls[0]?.url).toBe('https://registry.example/registry/metadata/v1/info')
  })
})

describe('upstream reply', () => {
  it('relays a null-body status instead of reporting the upstream unreachable', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    stubUpstream({ status: 204, body: null })

    const response = await GET(request(INFO))

    expect(response.status).toBe(204)
  })
})

const errorOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { error: string }).error

describe('routes not forwarded', () => {
  it('names the missing parameter when the rewrite carried no path', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    stubUpstream()

    const response = await GET(request(undefined))

    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe('Request did not carry exactly one path')
  })

  it('names the missing parameter when more than one path was injected', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    stubUpstream()

    const injected = new Request(
      `https://demo.example/api/registry?path=${encodeURIComponent(INFO)}&path=%2Fevil`,
    )
    const response = await GET(injected)

    expect(await errorOf(response)).toBe('Request did not carry exactly one path')
  })

  it('names the method a disallowed verb used, not the path alone', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    stubUpstream()

    const response = await POST(request(INFO, { method: 'POST', body: '{}' }))

    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe(`Route not forwarded: POST ${INFO}`)
  })
})

describe('the allowlist', () => {
  it('forwards each listed route under the verb it is listed with', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    await GET(request(INFO))
    await GET(request(INSTRUMENTS))
    await POST(request(FACTORY, { method: 'POST', body: '{"choiceArguments":{}}' }))

    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      `GET ${INFO}`,
      `GET ${INSTRUMENTS}`,
      `POST ${FACTORY}`,
    ])
  })

  it('refuses a path it does not list', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    const response = await GET(request('/registry/admin/v1/instruments'))

    expect(response.status).toBe(403)
    expect(calls).toEqual([])
  })

  it('refuses a GET on the route it lists as POST', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    const response = await GET(request(FACTORY))

    expect(response.status).toBe(403)
    expect(calls).toEqual([])
  })

  it('refuses a HEAD rather than forwarding it as the GET it is routed to', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    const response = await GET(request(INFO, { method: 'HEAD' }))

    expect(response.status).toBe(403)
    expect(calls).toEqual([])
  })

  it('sends only the parsed body, so nothing outside it reaches the registry', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    await POST(request(FACTORY, { method: 'POST', body: '{ "a": 1, "b": { "c": 2 } }' }))

    expect(calls[0]?.body).toBe('{"a":1,"b":{"c":2}}')
  })

  it('rejects a body that is not json before reaching the registry', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.example')
    const { calls } = stubUpstream()

    const response = await POST(request(FACTORY, { method: 'POST', body: 'not json' }))

    expect(response.status).toBe(400)
    expect(calls).toEqual([])
  })
})

describe('deployment configuration', () => {
  it('names REGISTRY_URL when the deployment did not set it', async () => {
    vi.stubEnv('REGISTRY_URL', '')
    stubUpstream()

    const response = await GET(request(INFO))

    expect(response.status).toBe(500)
    expect(await errorOf(response)).toContain('REGISTRY_URL')
  })

  it('does not name the registry host when the upstream cannot be reached', async () => {
    vi.stubEnv('REGISTRY_URL', 'https://registry.internal:3013')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed: connect ECONNREFUSED 10.0.0.7:3013')
    })

    const response = await GET(request(INFO))

    expect(response.status).toBe(502)
    expect(await errorOf(response)).toBe('Upstream unreachable')
  })
})

// This proxy and the browser client that calls it are the two legs of one registry read, so a longer
// budget on either only makes the caller wait past a hop that has already given up. Held by reading
// both files rather than by sharing a module: `api/` is its own tsconfig project and never imports
// from `src/`.
describe('the upstream timeout', () => {
  const budgetOf = async (path: string): Promise<string | undefined> =>
    /_TIMEOUT_MS = ([\d_]+)/.exec(await readFile(new URL(path, import.meta.url), 'utf8'))?.[1]

  it('matches the budget the browser client gives the same read', async () => {
    const [proxy, client] = await Promise.all([
      budgetOf('./registry.ts'),
      budgetOf('../src/backend/registry.ts'),
    ])

    expect(proxy).toBe('15_000')
    expect(client).toBe(proxy)
  })
})
