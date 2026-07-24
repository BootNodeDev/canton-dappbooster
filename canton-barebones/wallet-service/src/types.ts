// Hand-authored TypeScript types for the schemas in
// ../api-specs/openrpc-dapp-api.json that wallet-service consumes or produces.
// Refresh when the spec is bumped; see api-specs/README.md.

export type JsonRpcId = string | number | null

export type JsonRpcRequest = {
  jsonrpc?: '2.0'
  id?: JsonRpcId
  method?: unknown
  params?: unknown
}

export type JsonRpcSuccess = {
  jsonrpc: '2.0'
  id: JsonRpcId
  result: unknown
}

export type JsonRpcError = {
  jsonrpc: '2.0'
  id: JsonRpcId
  error: { code: number; message: string; data?: unknown }
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError

// --- openrpc-dapp-api.json schemas ---

export type Network = {
  networkId: string
  ledgerApi?: string
  accessToken?: string
}

export type Provider = {
  id: string
  clientType: string
  version?: string
  providerType?: 'browser' | 'desktop' | 'mobile' | 'remote'
  url?: string
  userUrl?: string
}

export type ConnectResult = {
  isConnected: boolean
  reason?: string
  isNetworkConnected: boolean
  networkReason?: string
  userUrl?: string
}

export type Session = {
  accessToken: string
  userId: string
}

export type StatusEvent = {
  provider: Provider
  connection: ConnectResult
  network?: Network
  session?: Session
}

// JsCommands is intentionally loose — the SDK validates the inner shape.
export type JsCommands = unknown

export type DisclosedContract = {
  createdEventBlob: string
  templateId?: string
  contractId?: string
  synchronizerId?: string
}

export type JsPrepareSubmissionRequest = {
  commands: JsCommands
  commandId?: string
  actAs?: string[]
  readAs?: string[]
  disclosedContracts?: DisclosedContract[]
  synchronizerId?: string
  packageIdSelectionPreference?: string[]
}

export type LedgerApiRequest = {
  requestMethod: 'get' | 'post' | 'patch' | 'put' | 'delete'
  resource: string
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  path?: Record<string, unknown>
}

export type Wallet = {
  primary: boolean
  partyId: string
  status: 'initialized' | 'allocated' | 'removed'
  hint: string
  publicKey: string
  namespace: string
  networkId: string
  signingProviderId: string
  externalTxId?: string
  topologyTransactions?: string
  disabled?: boolean
  reason?: string
}

export type ListAccountsResult = Wallet[]
