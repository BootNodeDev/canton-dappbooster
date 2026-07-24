// WALLET_SERVICE_MOCK=1 short-circuits the real Canton SDK so carpincho-wallet
// can drive the wire end-to-end without Docker / Canton / DAML running. The
// mock matches the shapes that createRpc / createPartyApi return so server.ts
// can swap them in at boot without adapting any HTTP wiring.
//
// State (party Map + monotonic offset) lives in a shared MockState passed to
// both factories so a party onboarded through /admin/party/* could in theory be
// referenced by a future listAccounts implementation. The mock listAccounts is
// still [] today; the state is plumbed for future use.

import crypto from 'node:crypto'
import type { WalletServiceConfig } from './config.ts'
import type { PartyApi } from './party.ts'
import type { Rpc, WalletSdk } from './rpc.ts'
import { buildProvider, InvalidParams, objectParam, rpcError, rpcResult } from './rpc.ts'
import type {
  ConnectResult,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  Network,
  Provider,
  StatusEvent,
} from './types.ts'

export interface MockState {
  parties: Map<string, { partyId: string }>
  offset: number
}

export const createMockState = (): MockState => ({ parties: new Map(), offset: 0 })

export const isMockEnabled = (): boolean => {
  const value = process.env.WALLET_SERVICE_MOCK
  if (value === undefined) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const randomBase64 = (bytes: number): string => crypto.randomBytes(bytes).toString('base64')

const slugify = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 32) || 'mock'

const mockNetworkId = (config: WalletServiceConfig): string => `${config.network}-mock`

const mockProvider = (config: WalletServiceConfig): Provider => buildProvider(config.provider)

const mockConnection = (): ConnectResult => ({
  isConnected: false,
  reason: 'wallet-service mock: no real Canton participant attached.',
  isNetworkConnected: true,
  networkReason: 'mock backend always reports ready',
})

const mockNetwork = (config: WalletServiceConfig): Network => ({ networkId: mockNetworkId(config) })

const mockStatus = (config: WalletServiceConfig): StatusEvent => ({
  provider: mockProvider(config),
  connection: mockConnection(),
  network: mockNetwork(config),
})

const pickPartyId = (p: Record<string, unknown>): string | undefined => {
  if (typeof p.partyId === 'string' && p.partyId.length > 0) {
    return p.partyId
  }
  if (Array.isArray(p.actAs) && typeof p.actAs[0] === 'string' && p.actAs[0].length > 0) {
    return p.actAs[0]
  }
  return undefined
}

export const createMockRpc = (
  config: WalletServiceConfig,
  state: MockState = createMockState(),
): Rpc => {
  const prepareTransaction = (params: unknown): unknown => {
    const p = objectParam<Record<string, unknown>>(params, 'prepareTransaction')
    const partyId = pickPartyId(p)
    if (partyId === undefined) {
      throw new InvalidParams('partyId or actAs[0] is required')
    }
    if (p.commands === undefined) {
      throw new InvalidParams('commands is required')
    }
    return {
      preparedTransaction: randomBase64(64),
      preparedTransactionHash: randomBase64(32),
      hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
    }
  }

  const executePrepared = (params: unknown): unknown => {
    const p = objectParam<Record<string, unknown>>(params, 'executePrepared')
    if (
      typeof p.preparedTransaction !== 'string' ||
      typeof p.preparedTransactionHash !== 'string'
    ) {
      throw new InvalidParams('preparedTransaction and preparedTransactionHash are required')
    }
    if (typeof p.signatureBase64 !== 'string' || p.signatureBase64.length === 0) {
      throw new InvalidParams('signatureBase64 is required')
    }
    state.offset += 1
    return {
      updateId: `mock-update-${crypto.randomBytes(6).toString('hex')}`,
      completionOffset: state.offset,
    }
  }

  const ledgerApi = (params: unknown): unknown => {
    const p = objectParam<Record<string, unknown>>(params, 'ledgerApi')
    if (p.requestMethod !== 'post' || p.resource !== '/v2/state/active-contracts') {
      throw new Error('Only POST /v2/state/active-contracts is implemented in this mock')
    }
    return { contracts: [] }
  }

  const dispatch = (id: JsonRpcId, request: JsonRpcRequest): JsonRpcResponse => {
    if (request.jsonrpc !== undefined && request.jsonrpc !== '2.0') {
      return rpcError(id, -32600, 'Invalid request', { reason: 'jsonrpc must be "2.0"' })
    }
    if (typeof request.method !== 'string') {
      return rpcError(id, -32600, 'Invalid request', { reason: 'method must be a string' })
    }
    try {
      switch (request.method) {
        case 'status':
          return rpcResult(id, mockStatus(config))
        case 'connect':
        case 'isConnected':
          return rpcResult(id, mockConnection())
        case 'disconnect':
          return rpcResult(id, null)
        case 'getActiveNetwork':
          return rpcResult(id, mockNetwork(config))
        case 'listAccounts':
          return rpcResult(id, [])
        case 'getPrimaryAccount':
          return rpcError(id, -32001, 'Resource not found', {
            reason: 'mock has no primary account configured.',
          })
        case 'prepareTransaction':
          return rpcResult(id, prepareTransaction(request.params))
        case 'executePrepared':
          return rpcResult(id, executePrepared(request.params))
        case 'ledgerApi':
          return rpcResult(id, ledgerApi(request.params))
        case 'cip56.listPendingTransfers':
          return rpcResult(id, [])
        case 'cip56.listHoldingSummary':
          return rpcResult(id, [])
        case 'cip56.listHoldings':
          return rpcResult(id, [])
        case 'cip56.createTransfer':
          return rpcResult(id, { commands: [], disclosedContracts: [] })
        case 'amulet.preapproval.status':
          return rpcResult(id, { active: false, expired: false })
        case 'amulet.tap':
          return rpcResult(id, {
            commands: { ExerciseCommand: { choice: 'AmuletRules_DevNet_Tap' } },
            disclosedContracts: [],
          })
        case 'amulet.preapproval.create':
        case 'amulet.preapproval.cancel':
          return rpcResult(id, { commands: [], disclosedContracts: [] })
        case 'amulet.preapproval.acceptProposal':
          return rpcResult(id, { updateId: 'mock-amulet-preapproval-accept', completionOffset: 0 })
        case 'prepareExecute':
        case 'prepareExecuteAndWait':
        case 'signMessage':
          return rpcError(id, -32004, 'Method not supported', {
            method: request.method,
            reason: 'mock has no signer; use Carpincho over WalletConnect for these methods.',
          })
        default:
          return rpcError(id, -32601, 'Method not found', { method: request.method })
      }
    } catch (error) {
      if (error instanceof InvalidParams) {
        return rpcError(id, -32602, error.message, { method: request.method })
      }
      const message = error instanceof Error ? error.message : String(error)
      return rpcError(id, -32000, message)
    }
  }

  const handle = async (request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> => {
    const isNotification = !('id' in request)
    const id = request.id ?? null
    const response = dispatch(id, request)
    return isNotification ? undefined : response
  }

  const getSdk = async (): Promise<WalletSdk> => {
    throw new Error(
      'mock mode: SDK is not available — set WALLET_SERVICE_MOCK=0 for real Canton calls',
    )
  }

  const serviceInfo = (): Record<string, unknown> => ({
    service: 'wallet-service',
    rpcEndpoint: '/rpc',
    api: 'Carpincho service bridge over JSON-RPC 2.0 (MOCK MODE)',
    dappApi: 'CIP-0103 mock — short-circuits before any Canton SDK call.',
    mock: true,
    supportedMethods: [
      'status',
      'connect',
      'disconnect',
      'isConnected',
      'getActiveNetwork',
      'listAccounts',
      'getPrimaryAccount',
      'ledgerApi',
      'prepareTransaction',
      'executePrepared',
      'cip56.listPendingTransfers',
      'cip56.listHoldingSummary',
      'cip56.listHoldings',
      'cip56.createTransfer',
      'amulet.preapproval.status',
      'amulet.tap',
      'amulet.preapproval.create',
      'amulet.preapproval.acceptProposal',
      'amulet.preapproval.cancel',
    ],
    reservedMethods: ['prepareExecute', 'prepareExecuteAndWait', 'signMessage'],
    network: mockNetworkId(config),
    provider: mockProvider(config),
  })

  return { handle, serviceInfo, getSdk }
}

export const createMockPartyApi = (
  _config: WalletServiceConfig,
  state: MockState = createMockState(),
): PartyApi => {
  const prepare = async (params: {
    publicKeyBase64?: string
    partyHint?: string
  }): Promise<unknown> => {
    if (params.publicKeyBase64 === undefined || params.publicKeyBase64.trim() === '') {
      throw new InvalidParams('publicKeyBase64 is required')
    }
    const partyHint = params.partyHint?.trim()
    if (partyHint === '') {
      throw new InvalidParams('partyHint cannot be empty')
    }
    const onboardingId = crypto.randomUUID()
    const slug = slugify(partyHint === undefined ? 'mock' : partyHint)
    const partyId = `${slug}::mock-${crypto.randomBytes(6).toString('hex')}`
    state.parties.set(onboardingId, { partyId })
    return {
      onboardingId,
      partyId,
      multiHash: randomBase64(32),
      topologyTransactions: [],
    }
  }

  const complete = async (params: {
    onboardingId?: string
    signatureBase64?: string
    expectHeavyLoad?: boolean
  }): Promise<unknown> => {
    if (params.onboardingId === undefined || params.onboardingId.length === 0) {
      throw new InvalidParams('onboardingId is required')
    }
    if (params.signatureBase64 === undefined || params.signatureBase64.length === 0) {
      throw new InvalidParams('signatureBase64 is required')
    }
    const entry = state.parties.get(params.onboardingId)
    if (entry === undefined) {
      throw new InvalidParams('party onboarding request not found or expired')
    }
    state.parties.delete(params.onboardingId)
    return { partyId: entry.partyId }
  }

  return { prepare, complete, pendingSize: () => state.parties.size }
}
