// An https page cannot reach plain-http wallet-service, but Node's fetch has no mixed-content
// policy. One method only: the whole dispatcher would republish `executePrepared` unauthenticated.

const ALLOWED_METHOD = 'amulet.tap'
const UPSTREAM_TIMEOUT_MS = 15_000

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const fail = (id: unknown, code: number, message: string, status: number): Response =>
  json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, status)

export const POST = async (request: Request): Promise<Response> => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail(null, -32700, 'Parse error', 400)
  }

  // A batch array is how a second method would ride along beside the allowed one.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return fail(null, -32600, 'Only a single amulet.tap request is forwarded', 400)
  }

  const { id, method, params } = body as { id?: unknown; method?: unknown; params?: unknown }
  if (method !== ALLOWED_METHOD) {
    return fail(id, -32601, `Method not forwarded: ${String(method)}`, 403)
  }

  // No default: localhost cannot be right in the only environment this file runs in.
  const upstreamUrl = process.env.WALLET_SERVICE_RPC_URL
  if (!upstreamUrl) {
    return fail(id, -32000, 'WALLET_SERVICE_RPC_URL is not set on this deployment', 500)
  }

  // Rebuilt rather than relayed, so nothing outside these fields reaches wallet-service.
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: id ?? '1', method: ALLOWED_METHOD, params }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    return json(await upstream.json(), upstream.status)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return fail(id, -32000, `Upstream: ${message}`, 502)
  }
}
