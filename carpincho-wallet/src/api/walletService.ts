import { loadRuntimeConfigAsync } from '@/config/runtimeConfig'

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

// Non-string messages would otherwise coerce to "[object Object]".
const coerceMessage = (message: unknown, code: number): string => {
  if (typeof message === 'string') {
    return message
  }
  try {
    return JSON.stringify(message) ?? `wallet-service error ${code}`
  } catch {
    return String(message)
  }
}

export class WalletServiceRpcError extends Error {
  code: number
  data?: unknown

  constructor(error: JsonRpcErrorObject) {
    super(coerceMessage(error.message, error.code))
    this.name = 'WalletServiceRpcError'
    this.code = error.code
    this.data = error.data
  }
}

export interface WalletServiceRequestOptions {
  rpcUrl?: string
}

export interface WalletServiceStatusResponse {
  connection?: {
    isConnected?: boolean
    isNetworkConnected?: boolean
    reason?: string
    networkReason?: string
  }
  network?: {
    networkId?: string
    ledgerApi?: string
    accessToken?: string
  }
  session?: {
    accessToken?: string
    userId?: string
  }
}

export interface DarUploadResponse {
  ok: true
  vetAllPackages: true
  response: unknown
}

const rpcUrl = async (options?: WalletServiceRequestOptions): Promise<string> =>
  options?.rpcUrl?.trim() === undefined || options.rpcUrl.trim() === ''
    ? (await loadRuntimeConfigAsync()).walletServiceRpcUrl
    : options.rpcUrl.trim()

export const walletServiceRequest = async <T>(
  method: string,
  params?: unknown,
  options?: WalletServiceRequestOptions,
): Promise<T> => {
  const response = await fetch(await rpcUrl(options), {
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

// Reads the wallet-service dApp status so Carpincho uses the same network source as wallet-gateway.
export const walletServiceStatus = async (
  options?: WalletServiceRequestOptions,
): Promise<WalletServiceStatusResponse> =>
  await walletServiceRequest<WalletServiceStatusResponse>('status', undefined, options)

// Extracts the active network id and fails when wallet-service cannot provide one.
export const networkIdFromWalletServiceStatus = (status: WalletServiceStatusResponse): string => {
  const networkId = status.network?.networkId?.trim()
  if (networkId === undefined || networkId === '') {
    throw new Error('wallet-service status did not include networkId')
  }
  return networkId
}

// Discovers the active Canton network from wallet-service status.
export const getWalletServiceNetworkId = async (
  options?: WalletServiceRequestOptions,
): Promise<string> => networkIdFromWalletServiceStatus(await walletServiceStatus(options))

type AdminRequestOptions = WalletServiceRequestOptions

// Reuses the configured JSON-RPC base so admin utilities follow the same wallet-service target.
const adminUrl = async (path: string, options?: AdminRequestOptions): Promise<string> => {
  const base =
    options?.rpcUrl?.trim() === undefined || options.rpcUrl.trim() === ''
      ? (await loadRuntimeConfigAsync()).walletServiceRpcUrl
      : options.rpcUrl.trim()
  return `${base.replace(/\/rpc\/?$/, '')}${path}`
}

export const walletServiceAdminPost = async <TResult>(
  path: string,
  body: Record<string, unknown>,
  options?: AdminRequestOptions,
): Promise<TResult> => {
  const response = await fetch(await adminUrl(path, options), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`wallet-service HTTP ${response.status}${text === '' ? '' : `: ${text}`}`)
  }
  return (await response.json()) as TResult
}

// Sends compiled DAML archives as raw bytes so wallet-service can keep the ledger token boundary.
export const uploadDarFile = async (
  file: File,
  options?: AdminRequestOptions,
): Promise<DarUploadResponse> => {
  const response = await fetch(await adminUrl('/admin/dars', options), {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`wallet-service HTTP ${response.status}${text === '' ? '' : `: ${text}`}`)
  }
  return (await response.json()) as DarUploadResponse
}

export const prepareCreateParty = async (
  body: { publicKeyBase64: string; partyHint: string },
  options?: AdminRequestOptions,
): Promise<{ onboardingId: string; partyId: string; multiHash: string }> =>
  await walletServiceAdminPost('/admin/party/prepare', body, options)

export const completeCreateParty = async (
  body: { onboardingId: string; signatureBase64: string; expectHeavyLoad?: boolean },
  options?: AdminRequestOptions,
): Promise<{ partyId: string }> =>
  await walletServiceAdminPost('/admin/party/complete', body, options)
