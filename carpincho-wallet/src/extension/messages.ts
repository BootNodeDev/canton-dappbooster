export const CARPINCHO_PROVIDER_ID = 'carpincho-wallet'
export const CARPINCHO_PROVIDER_NAME = 'Carpincho Wallet'

export const WalletEvent = {
  SPLICE_WALLET_REQUEST: 'SPLICE_WALLET_REQUEST',
  SPLICE_WALLET_RESPONSE: 'SPLICE_WALLET_RESPONSE',
  SPLICE_WALLET_EXT_READY: 'SPLICE_WALLET_EXT_READY',
  SPLICE_WALLET_EXT_ACK: 'SPLICE_WALLET_EXT_ACK',
  SPLICE_WALLET_EXT_OPEN: 'SPLICE_WALLET_EXT_OPEN',
  // Carpincho extension: wallet → page push for dapp-api event methods.
  SPLICE_WALLET_EVENT: 'SPLICE_WALLET_EVENT',
} as const

type WalletEventValue<K extends keyof typeof WalletEvent> = (typeof WalletEvent)[K]

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export interface SpliceWalletRequestMessage {
  type: WalletEventValue<'SPLICE_WALLET_REQUEST'>
  request: JsonRpcRequest
  target?: string
}

export interface SpliceWalletAckMessage {
  type: WalletEventValue<'SPLICE_WALLET_EXT_ACK'>
  target: typeof CARPINCHO_PROVIDER_ID
}

export interface RuntimeProviderRequest {
  type: 'CARPINCHO_PROVIDER_REQUEST'
  request: JsonRpcRequest
  origin: string
}

export interface RuntimePendingRequest {
  requestId: string
  request: JsonRpcRequest
  origin: string
  createdAt: number
}

export interface RuntimePendingRequestMessage {
  type: 'CARPINCHO_PENDING_REQUEST'
  pending: RuntimePendingRequest
}

export interface RuntimeProviderResponse {
  type: 'CARPINCHO_PROVIDER_RESPONSE'
  requestId: string
  response: JsonRpcResponse
}

export interface RuntimeGetPendingRequests {
  type: 'CARPINCHO_GET_PENDING_REQUESTS'
}

export interface RuntimeGetConnectedOrigins {
  type: 'CARPINCHO_GET_CONNECTED_ORIGINS'
}

// Popup → background: drop a direct injected-provider connection (wallet-initiated disconnect).
export interface RuntimeForgetConnectedOrigin {
  type: 'CARPINCHO_FORGET_CONNECTED_ORIGIN'
  origin: string
}

// Wallet→page broadcast: popup → background → content script → page.
export interface RuntimeBroadcastEvent {
  type: 'CARPINCHO_BROADCAST_EVENT'
  eventName: string
  payload: unknown
}

export interface RuntimeEventRelay {
  type: 'CARPINCHO_EVENT_RELAY'
  eventName: string
  payload: unknown
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isForCarpincho = (message: { target?: unknown }): boolean =>
  message.target === undefined || message.target === CARPINCHO_PROVIDER_ID

export const isSpliceWalletRequest = (value: unknown): value is SpliceWalletRequestMessage =>
  isRecord(value) &&
  value.type === WalletEvent.SPLICE_WALLET_REQUEST &&
  isRecord(value.request) &&
  value.request.jsonrpc === '2.0' &&
  typeof value.request.method === 'string'

export const extensionAck = (): SpliceWalletAckMessage => ({
  type: WalletEvent.SPLICE_WALLET_EXT_ACK,
  target: CARPINCHO_PROVIDER_ID,
})

export const jsonRpcResult = (id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  result,
})

export const jsonRpcError = (
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: data === undefined ? { code, message } : { code, message, data },
})
