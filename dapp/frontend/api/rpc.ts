// Forwards a single `amulet.tap` call to wallet-service, which the browser cannot reach itself: the
// deployed page is https and wallet-service is plain http, while Node's fetch has no mixed-content
// policy. Scoped to that one method on purpose — forwarding the dispatcher whole would republish
// `ledgerApi` and `executePrepared` unauthenticated on the product's own domain.

const ALLOWED_METHOD = 'amulet.tap'
// Server-side only, so the upstream address never reaches the bundle.
const UPSTREAM = process.env.WALLET_SERVICE_RPC_URL ?? 'http://localhost:3010/rpc'

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const refuse = (id: unknown, message: string): Response =>
  json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message } }, 403)

export const POST = async (request: Request): Promise<Response> => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400)
  }

  // A batch is an array, and one is exactly how another method would ride along beside the allowed
  // one, so only a lone object is accepted.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return refuse(null, 'Only a single amulet.tap request is forwarded')
  }

  const { id, method, params } = body as { id?: unknown; method?: unknown; params?: unknown }
  if (method !== ALLOWED_METHOD) {
    return refuse(id, `Method not forwarded: ${String(method)}`)
  }

  // Rebuilt rather than relayed, so nothing outside these fields reaches wallet-service.
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: id ?? '1', method: ALLOWED_METHOD, params }),
    })
    return json(await upstream.json(), upstream.status)
  } catch (error) {
    // An unreachable wallet-service or an html error page from whatever fronts it: either way the
    // caller gets a reason rather than a parse error naming nothing.
    const message = error instanceof Error ? error.message : 'unknown error'
    return json(
      { jsonrpc: '2.0', id: id ?? null, error: { code: -32000, message: `Upstream: ${message}` } },
      502,
    )
  }
}
