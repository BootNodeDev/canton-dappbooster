// JSON-RPC client for the wallet-service ledgerApi proxy. Salvaged verbatim from
// the working dapp/frontend direct/disclosure stack — framework-agnostic, no I/O
// beyond fetch, so it ports unchanged.

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

const errorMessage = (error: JsonRpcErrorObject): string => {
  if (typeof error.message === 'string') {
    return error.message
  }
  try {
    return JSON.stringify(error.message)
  } catch {
    return `wallet-service error ${error.code}`
  }
}

export class WalletServiceRpcError extends Error {
  code: number
  data?: unknown

  constructor(error: JsonRpcErrorObject) {
    super(errorMessage(error))
    this.name = 'WalletServiceRpcError'
    this.code = error.code
    this.data = error.data
  }
}

export const walletServiceRequest = async <T>(
  rpcUrl: string,
  method: string,
  params?: unknown,
): Promise<T> => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      ...(params === undefined ? {} : { params }),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`wallet-service HTTP ${response.status}${body === '' ? '' : `: ${body}`}`)
  }

  const payload = (await response.json()) as {
    result?: T
    error?: JsonRpcErrorObject
  }

  if (payload.error !== undefined) {
    throw new WalletServiceRpcError(payload.error)
  }
  return payload.result as T
}
