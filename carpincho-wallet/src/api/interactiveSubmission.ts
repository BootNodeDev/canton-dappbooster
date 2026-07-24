import { walletServiceRequest } from '@/api/walletService'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

interface PreparedTransactionResponse {
  preparedTransaction: string
  preparedTransactionHash: string
  hashingSchemeVersion:
    | 'HASHING_SCHEME_VERSION_UNSPECIFIED'
    | 'HASHING_SCHEME_VERSION_V2'
    | 'HASHING_SCHEME_VERSION_V3'
  hashingDetails?: string
  costEstimation?: unknown
}

export interface ExecutePreparedResponse {
  updateId?: string
  completionOffset?: number
}

// Unsigned commands wallet-service returns for Carpincho to sign and execute.
export interface WalletServiceCommands {
  commands: unknown
  disclosedContracts?: unknown[]
}

export interface ExecutePreparedCommandsParams {
  account: AccountPublic
  commands: unknown
  disclosedContracts?: unknown[]
  method: string
  summary: string
  commandId?: string
  submissionId?: string
  synchronizerId?: string
  signMessage: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

// Executes Canton interactive submission while Carpincho keeps private-key signing local.
export const executePreparedCommands = async ({
  account,
  commands,
  disclosedContracts,
  method,
  summary,
  commandId,
  submissionId,
  synchronizerId,
  signMessage,
  recordTransaction,
}: ExecutePreparedCommandsParams): Promise<ExecutePreparedResponse> => {
  const prepared = await walletServiceRequest<PreparedTransactionResponse>('prepareTransaction', {
    partyId: account.partyId,
    actAs: [account.partyId],
    commands,
    ...(disclosedContracts === undefined ? {} : { disclosedContracts }),
    ...(commandId === undefined ? {} : { commandId }),
    ...(submissionId === undefined ? {} : { submissionId }),
    ...(synchronizerId === undefined ? {} : { synchronizerId }),
  })
  const signatureBase64 = await signMessage(account.id, prepared.preparedTransactionHash)
  const executed = await walletServiceRequest<ExecutePreparedResponse>('executePrepared', {
    ...prepared,
    partyId: account.partyId,
    signatureBase64,
    ...(submissionId === undefined ? {} : { submissionId }),
  })

  await recordTransaction?.({
    accountId: account.id,
    accountName: account.name,
    partyId: account.partyId,
    network: account.network,
    method,
    status: 'executed',
    preparedTransaction: prepared.preparedTransaction,
    preparedTransactionHash: prepared.preparedTransactionHash,
    commands: Array.isArray(commands) ? commands : [commands],
    commandId,
    submissionId,
    updateId: executed.updateId,
    completionOffset: executed.completionOffset,
    commandCount: Array.isArray(commands) ? commands.length : 1,
    summary,
  })

  return executed
}
