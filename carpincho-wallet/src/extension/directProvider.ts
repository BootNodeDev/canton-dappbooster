import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  jsonRpcError,
  jsonRpcResult,
} from '@/extension/messages'
import { dispatchProviderRequest } from '@/provider/dispatch'
import { ACCESS_TIER, accessTier } from '@/provider/methods'
import type { AccountPublic } from '@/vault/types'

export interface DirectProviderSnapshot {
  accounts: AccountPublic[]
  primary: AccountPublic | null
}

export interface DirectProviderContext {
  // Whether the requesting origin has been granted access via an approved connect.
  isConnected: boolean
}

const EMPTY_SNAPSHOT: DirectProviderSnapshot = { accounts: [], primary: null }

// Runs the shared provider dispatch against a chosen snapshot and materializes a
// JSON-RPC response. Returns undefined when the method needs popup approval so the
// caller queues it for the user.
const runDispatch = async (
  request: JsonRpcRequest,
  snapshot: DirectProviderSnapshot,
): Promise<JsonRpcResponse | undefined> => {
  let response: JsonRpcResponse | undefined
  const result = await dispatchProviderRequest(
    { method: request.method, params: request.params },
    () => ({ accounts: snapshot.accounts, primary: snapshot.primary }),
    {
      result: async (value) => {
        response = jsonRpcResult(request.id, value)
      },
      error: async (code, message) => {
        response = jsonRpcError(request.id, code, message)
      },
    },
  )

  if (result.status === 'pending-approval') {
    return undefined
  }

  return response ?? jsonRpcError(request.id, -32603, 'Carpincho provider returned no response')
}

// Answers an injected-provider request, enforcing that only an origin the user has
// approved (`connect`) can reach account identity or signing. Unapproved origins get
// a disconnected view; `connect` itself is queued for explicit user approval.
export const createDirectProviderResponse = async (
  request: JsonRpcRequest,
  snapshot: DirectProviderSnapshot | null,
  context: DirectProviderContext = { isConnected: false },
): Promise<JsonRpcResponse | undefined> => {
  if (snapshot === null) {
    // Wallet locked / no snapshot: queue so the popup can prompt for unlock.
    return undefined
  }

  const tier = accessTier(request.method)

  // A connected origin is allowed everything; PUBLIC methods disclose no account
  // identity, so they are allowed regardless of connection state.
  if (context.isConnected || tier === ACCESS_TIER.PUBLIC) {
    return runDispatch(request, snapshot)
  }

  // Origin has not been granted access by the user yet.
  if (tier === ACCESS_TIER.CONNECT) {
    // Queue: the popup prompts the user to approve this origin before any accounts leave the wallet.
    return undefined
  }
  if (tier === ACCESS_TIER.IDENTITY) {
    // Answer from an empty snapshot: reports isConnected:false / empty accounts, leaks nothing.
    return runDispatch(request, EMPTY_SNAPSHOT)
  }
  // RESTRICTED (signMessage / prepareExecute / ledgerApi / unknown): refuse without prompting.
  return jsonRpcError(
    request.id,
    -32000,
    'not connected: call connect and approve it in Carpincho first',
  )
}
