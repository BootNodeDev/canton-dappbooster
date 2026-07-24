import { type Dispatch, type SetStateAction, useCallback } from 'react'
import {
  dispatchProviderRequest,
  type ProviderRequest,
  type ProviderResponder,
} from '@/provider/dispatch'
import {
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_SIGN_MESSAGE,
  normalizeMethod,
} from '@/provider/methods'
import type { AccountResolver } from '@/provider/types'
import { executeParams } from '@/views/home/transactionSummary'
import type {
  PendingConnectRequest,
  PendingExecuteRequest,
  PendingSignRequest,
} from '@/views/home/types'
import { selectedAccount } from '@/wc/accounts'

export interface ProviderRequestContext {
  rawMethod?: string
  origin?: string
}

export type ProviderRequestHandler = (
  request: ProviderRequest,
  responder: ProviderResponder,
  context: ProviderRequestContext,
) => Promise<void>

// Bridges dispatch results needing approval into pending-connect / -sign / -execute state.
// Shared by the WalletConnect and extension request paths.
export const useProviderRequestHandler = (
  resolveAccounts: AccountResolver,
  setPendingConnect: Dispatch<SetStateAction<PendingConnectRequest | undefined>>,
  setPendingSign: Dispatch<SetStateAction<PendingSignRequest | undefined>>,
  setPendingExecute: Dispatch<SetStateAction<PendingExecuteRequest | undefined>>,
): ProviderRequestHandler =>
  useCallback(
    async (request, responder, context) => {
      // connect reaches this handler only after the gatekeeper queued it for an unapproved
      // origin, so it must require explicit user approval rather than auto-resolving.
      if (normalizeMethod(request.method) === CANTON_METHOD_CONNECT) {
        setPendingConnect({ origin: context.origin, responder })
        return
      }
      const result = await dispatchProviderRequest(request, resolveAccounts, responder)
      if (
        result.status === 'pending-approval' &&
        result.pendingMethod === CANTON_METHOD_SIGN_MESSAGE
      ) {
        const messageBase64 = (request.params as { message?: string })?.message
        if (typeof messageBase64 !== 'string') {
          await responder.error(-32602, 'message param missing')
          return
        }
        const account = selectedAccount(resolveAccounts())
        if (account === undefined) {
          await responder.error(-32000, 'no account available')
          return
        }
        setPendingSign({ account, messageBase64, origin: context.origin, responder })
        return
      }
      if (
        result.status === 'pending-approval' &&
        (result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE ||
          result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT)
      ) {
        const account = selectedAccount(resolveAccounts())
        if (account === undefined) {
          await responder.error(-32000, 'no account available')
          return
        }
        setPendingExecute({
          account,
          method: result.pendingMethod,
          params: executeParams(request.params, account.partyId),
          rawMethod: context.rawMethod ?? request.method,
          origin: context.origin,
          responder,
        })
      }
    },
    [resolveAccounts, setPendingConnect, setPendingSign, setPendingExecute],
  )
