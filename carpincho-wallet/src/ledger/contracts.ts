import { type ExecutePreparedResponse, executePreparedCommands } from '@/api/interactiveSubmission'
import { walletServiceRequest } from '@/api/walletService'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface ActiveContract {
  contractId: string
  templateId: string
  createArgument: unknown
  createdOffset?: number
}

export interface CreateContractParams {
  account: AccountPublic
  templateId: string
  createArguments: Record<string, unknown>
  signMessage: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

export interface ExerciseContractParams {
  account: AccountPublic
  templateId: string
  contractId: string
  choice: string
  choiceArgument: Record<string, unknown>
  signMessage: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

export interface ListActiveContractsParams {
  partyId: string
}

interface LedgerEndResponse {
  offset?: number
}

type JsonActiveContractEntry = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId?: unknown
        templateId?: unknown
        createArgument?: unknown
        offset?: unknown
      }
    }
  }
}

const CREATE_COMMAND_KIND = 'CreateCommand'
const EXERCISE_COMMAND_KIND = 'ExerciseCommand'

// Builds the JSON Ledger API command shape expected by wallet-service prepareTransaction.
export const createCommand = (
  templateId: string,
  createArguments: Record<string, unknown>,
): unknown[] => [
  {
    [CREATE_COMMAND_KIND]: {
      templateId,
      createArguments,
    },
  },
]

// Builds a generic choice exercise command while leaving argument validation to Canton.
export const exerciseCommand = (
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown>,
): unknown[] => [
  {
    [EXERCISE_COMMAND_KIND]: {
      templateId,
      contractId,
      choice,
      choiceArgument,
    },
  },
]

// Returns a readable suffix without assuming a template-id package format.
const templateLabel = (templateId: string): string => {
  const parts = templateId.split(':')
  return parts[parts.length - 1] ?? templateId
}

// Creates one contract while keeping transaction signing inside the selected vault account.
export const createContract = async ({
  account,
  templateId,
  createArguments,
  signMessage,
  recordTransaction,
}: CreateContractParams): Promise<ExecutePreparedResponse> =>
  await executePreparedCommands({
    account,
    commands: createCommand(templateId, createArguments),
    method: 'ledger.contract.create',
    summary: `Create ${templateLabel(templateId)}`,
    signMessage,
    recordTransaction,
  })

// Exercises one choice while keeping transaction signing inside the selected vault account.
export const exerciseContract = async ({
  account,
  templateId,
  contractId,
  choice,
  choiceArgument,
  signMessage,
  recordTransaction,
}: ExerciseContractParams): Promise<ExecutePreparedResponse> =>
  await executePreparedCommands({
    account,
    commands: exerciseCommand(templateId, contractId, choice, choiceArgument),
    method: 'ledger.contract.exercise',
    summary: `Exercise ${choice}`,
    signMessage,
    recordTransaction,
  })

// Calls the participant JSON API through wallet-service so Carpincho never stores ledger tokens.
const ledgerApi = async <T>(params: {
  requestMethod: 'get' | 'post'
  resource: string
  body?: Record<string, unknown>
}): Promise<T> => await walletServiceRequest<T>('ledgerApi', params)

// Reads the current ledger end because active-contract queries require an explicit snapshot offset.
const ledgerEnd = async (): Promise<number> => {
  const response = await ledgerApi<LedgerEndResponse>({
    requestMethod: 'get',
    resource: '/v2/state/ledger-end',
  })
  if (typeof response.offset !== 'number') {
    throw new Error('ledger end response did not include numeric offset')
  }
  return response.offset
}

// Uses wildcard ACS because participant filters expect package names, while commands often use hashes.
const activeContractFilter = (): Record<string, unknown> => ({
  WildcardFilter: { value: { includeCreatedEventBlob: false } },
})

// Normalizes JSON API active-contract entries into the compact UI model.
const activeContractFromEntry = (entry: JsonActiveContractEntry): ActiveContract | undefined => {
  const event = entry.contractEntry?.JsActiveContract?.createdEvent
  if (
    typeof event?.contractId !== 'string' ||
    typeof event.templateId !== 'string' ||
    event.createArgument === undefined
  ) {
    return undefined
  }
  return {
    contractId: event.contractId,
    templateId: event.templateId,
    createArgument: event.createArgument,
    ...(typeof event.offset === 'number' ? { createdOffset: event.offset } : {}),
  }
}

// Matches exact template ids and package-agnostic module/template suffixes for dev-time lookup.
export const matchesTemplate = (contract: ActiveContract, templateId?: string): boolean => {
  const trimmed = templateId?.trim()
  if (trimmed === undefined || trimmed === '') {
    return true
  }
  if (contract.templateId === trimmed) {
    return true
  }
  const suffix = trimmed.includes(':') ? `:${trimmed.split(':').slice(1).join(':')}` : trimmed
  return contract.templateId.endsWith(suffix)
}

// UI filter: a query hits a contract by template (exact/suffix) or contract-id substring.
export const contractMatchesQuery = (contract: ActiveContract, query: string): boolean => {
  const trimmed = query.trim()
  if (trimmed === '') {
    return true
  }
  return (
    matchesTemplate(contract, trimmed) ||
    contract.contractId.toLowerCase().includes(trimmed.toLowerCase())
  )
}

// Lists active contracts visible to the selected party using JSON Ledger API v2 ACS.
export const listActiveContracts = async ({
  partyId,
}: ListActiveContractsParams): Promise<ActiveContract[]> => {
  const activeAtOffset = await ledgerEnd()
  const entries = await ledgerApi<JsonActiveContractEntry[]>({
    requestMethod: 'post',
    resource: '/v2/state/active-contracts',
    body: {
      filter: {
        filtersByParty: {
          [partyId]: {
            cumulative: [
              {
                identifierFilter: activeContractFilter(),
              },
            ],
          },
        },
      },
      activeAtOffset,
      verbose: true,
    },
  })
  return entries.flatMap((entry) => {
    const contract = activeContractFromEntry(entry)
    return contract === undefined ? [] : [contract]
  })
}
