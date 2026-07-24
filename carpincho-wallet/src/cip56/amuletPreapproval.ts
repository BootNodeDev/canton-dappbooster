import {
  type ExecutePreparedResponse,
  executePreparedCommands,
  type WalletServiceCommands,
} from '@/api/interactiveSubmission'
import { walletServiceRequest } from '@/api/walletService'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface AmuletPreapprovalStatus {
  active: boolean
  expired: boolean
  contractId?: string
  templateId?: string
  expiresAt?: string
}

export interface AmuletPreapprovalActionParams {
  account: AccountPublic
  signMessage: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

export interface AmuletTapApi {
  tapAmulet: (params: AmuletPreapprovalActionParams) => Promise<ExecutePreparedResponse>
}

// Detects whether wallet-service returned a real command that needs signing.
const hasCommands = (commands: unknown): boolean =>
  Array.isArray(commands) ? commands.length > 0 : commands !== undefined && commands !== null

// Matches stale cancel attempts where the preapproval disappeared before prepare.
const isMissingPreapprovalError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('CONTRACT_NOT_FOUND') || message.includes('Contract could not be found')
}

// Reads the current Amulet auto-accept state for a receiver party.
export const getAmuletPreapprovalStatus = async (
  receiver: string,
): Promise<AmuletPreapprovalStatus> =>
  await walletServiceRequest<AmuletPreapprovalStatus>('amulet.preapproval.status', { receiver })

// Requests the fixed 100 AMT DevNet faucet command while Carpincho keeps the receiver key local.
export const tapAmulet = async ({
  account,
  signMessage,
  recordTransaction,
}: AmuletPreapprovalActionParams): Promise<ExecutePreparedResponse> => {
  const { commands, disclosedContracts } = await walletServiceRequest<WalletServiceCommands>(
    'amulet.tap',
    { receiver: account.partyId },
  )
  return await executePreparedCommands({
    account,
    commands,
    disclosedContracts,
    method: 'amulet.tap',
    summary: 'Tap 100 AMT',
    signMessage,
    recordTransaction,
  })
}

// Enables Amulet auto-accept while keeping the receiver signature inside Carpincho.
export const createAmuletPreapproval = async ({
  account,
  signMessage,
  recordTransaction,
}: AmuletPreapprovalActionParams): Promise<ExecutePreparedResponse> => {
  const { commands, disclosedContracts } = await walletServiceRequest<WalletServiceCommands>(
    'amulet.preapproval.create',
    { receiver: account.partyId },
  )
  return await executePreparedCommands({
    account,
    commands,
    disclosedContracts,
    method: 'amulet.preapproval.create',
    summary: 'Enable Amulet auto-accept',
    signMessage,
    recordTransaction,
  })
}

// Disables Amulet auto-accept while keeping the receiver signature inside Carpincho.
export const cancelAmuletPreapproval = async ({
  account,
  signMessage,
  recordTransaction,
}: AmuletPreapprovalActionParams): Promise<ExecutePreparedResponse> => {
  const { commands, disclosedContracts } = await walletServiceRequest<WalletServiceCommands>(
    'amulet.preapproval.cancel',
    { receiver: account.partyId },
  )
  if (!hasCommands(commands)) {
    return {}
  }
  try {
    return await executePreparedCommands({
      account,
      commands,
      disclosedContracts,
      method: 'amulet.preapproval.cancel',
      summary: 'Disable Amulet auto-accept',
      signMessage,
      recordTransaction,
    })
  } catch (error) {
    if (isMissingPreapprovalError(error)) {
      const status = await getAmuletPreapprovalStatus(account.partyId)
      if (!status.active && !status.expired) {
        return {}
      }
    }
    throw error
  }
}
