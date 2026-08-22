import 'dotenv/config'

import cors from 'cors'
import express from 'express'
import { loadConfig } from './config.ts'
import { createPartyApi } from './party.ts'
import { createRpc, InvalidParams } from './rpc.ts'
import type { JsonRpcRequest, JsonRpcResponse } from './types.ts'

const config = loadConfig()
const rpc = createRpc(config)
const adminParty = createPartyApi(config, { getSdk: () => rpc.getSdk() })
const app = express()

app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'wallet-service', network: config.network })
})

app.get('/', (_req, res) => {
  res.json(rpc.serviceInfo())
})

app.get('/wallet-service/info', (_req, res) => {
  res.json(rpc.serviceInfo())
})

const handleAdminError = (res: express.Response, error: unknown): void => {
  if (error instanceof InvalidParams) {
    res.status(400).json({ error: error.message })
    return
  }
  console.error('[wallet-service] admin failed', error)
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
}

app.post('/admin/party/prepare', async (req, res) => {
  const body = req.body as { publicKeyBase64?: string; partyHint?: string }
  try {
    res.json(await adminParty.prepare(body))
  } catch (error) {
    handleAdminError(res, error)
  }
})

app.post('/admin/party/complete', async (req, res) => {
  const body = req.body as {
    onboardingId?: string
    signatureBase64?: string
    expectHeavyLoad?: boolean
  }
  try {
    res.json(await adminParty.complete(body))
  } catch (error) {
    handleAdminError(res, error)
  }
})

app.post('/rpc', async (req, res) => {
  const body = req.body as unknown
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        message: 'Invalid request',
        data: { reason: 'JSON-RPC body must be an object' },
      },
    }
    res.json(response)
    return
  }
  const response = await rpc.handle(body as JsonRpcRequest)
  if (response === undefined) {
    res.status(204).end()
    return
  }
  res.json(response)
})

app.listen(config.port, () => {
  console.log(`wallet-service listening on ${config.port} (token: ${config.canton.tokenSource})`)
})
