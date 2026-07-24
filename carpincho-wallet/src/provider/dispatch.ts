import { accountToCip103Wallet } from '@/provider/accounts'
import {
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_DISCONNECT,
  CANTON_METHOD_GET_ACTIVE_NETWORK,
  CANTON_METHOD_GET_PRIMARY_ACCOUNT,
  CANTON_METHOD_IS_CONNECTED,
  CANTON_METHOD_LEDGER_API,
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_SIGN_MESSAGE,
  CANTON_METHOD_STATUS,
  isExecuteApprovalMethod,
  normalizeMethod,
  pendingApprovalMethod,
} from '@/provider/methods'
import { buildStatus, getActiveNetwork } from '@/provider/status'
import type {
  AccountResolver,
  DispatchResult,
  ProviderRequest,
  ProviderResponder,
} from '@/provider/types'
import { forwardToWalletService } from '@/provider/walletService'
import { accountConnection } from '@/wc/accounts'

export * from '@/provider/methods'
export type {
  AccountResolver,
  DispatchResult,
  ProviderRequest,
  ProviderResponder,
} from '@/provider/types'

// Converts wallet-service discovery failures into JSON-RPC provider errors.
const respondWalletServiceError = async (
  responder: ProviderResponder,
  error: unknown,
): Promise<DispatchResult> => {
  await responder.error(-32000, `wallet-service: ${(error as Error).message}`)
  return { status: 'error' }
}

export const dispatchProviderRequest = async (
  request: ProviderRequest,
  resolve: AccountResolver,
  responder: ProviderResponder,
): Promise<DispatchResult> => {
  const rawMethod = request.method
  const method = normalizeMethod(rawMethod)
  const { accounts, primary } = resolve()

  if (method === CANTON_METHOD_CONNECT || method === CANTON_METHOD_IS_CONNECTED) {
    try {
      const status = await buildStatus()
      await responder.result(accountConnection({ accounts, primary }, status.connection))
      return { status: 'handled' }
    } catch (error) {
      return await respondWalletServiceError(responder, error)
    }
  }
  if (method === CANTON_METHOD_DISCONNECT) {
    await responder.result(null)
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_LIST_ACCOUNTS) {
    await responder.result(accounts.map(accountToCip103Wallet))
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_GET_PRIMARY_ACCOUNT) {
    if (primary === null) {
      await responder.error(-32000, 'no primary account configured')
      return { status: 'error' }
    }
    await responder.result(accountToCip103Wallet(primary))
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_STATUS) {
    try {
      const status = await buildStatus()
      await responder.result({
        ...status,
        connection: accountConnection({ accounts, primary }, status.connection),
      })
      return { status: 'handled' }
    } catch (error) {
      return await respondWalletServiceError(responder, error)
    }
  }
  if (method === CANTON_METHOD_GET_ACTIVE_NETWORK) {
    try {
      await responder.result(await getActiveNetwork())
      return { status: 'handled' }
    } catch (error) {
      return await respondWalletServiceError(responder, error)
    }
  }
  if (method === CANTON_METHOD_SIGN_MESSAGE) {
    return { status: 'pending-approval', pendingMethod: CANTON_METHOD_SIGN_MESSAGE }
  }
  if (isExecuteApprovalMethod(method)) {
    return {
      status: 'pending-approval',
      pendingMethod: pendingApprovalMethod(rawMethod, method),
    }
  }
  if (method === CANTON_METHOD_LEDGER_API) {
    return await forwardToWalletService(request, method, responder)
  }

  await responder.error(-32601, `method not supported by Carpincho Wallet: ${request.method}`)
  return { status: 'error' }
}
