import type {
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
} from '@/provider/methods'
import type { ProviderResponder } from '@/provider/types'
import type { AccountPublic } from '@/vault/types'

export interface PendingConnectRequest {
  origin?: string
  responder: ProviderResponder
}

export interface PendingSignRequest {
  account: AccountPublic
  messageBase64: string
  origin?: string
  responder: ProviderResponder
}

export interface PendingExecuteRequest {
  account: AccountPublic
  method: typeof CANTON_METHOD_PREPARE_EXECUTE | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT
  params: Record<string, unknown>
  rawMethod: string
  origin?: string
  responder: ProviderResponder
}
