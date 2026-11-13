// The shape of the CIP-0103 `ledgerApi` call.
export type LedgerApiParams = {
  body?: unknown
  path?: Record<string, string>
  query?: Record<string, string | number | boolean>
  requestMethod: 'get' | 'post' | 'put' | 'patch' | 'delete'
  resource: string
}

export type LedgerCommand = {
  ExerciseCommand: {
    choice: string
    choiceArgument: Record<string, unknown>
    contractId: string
    templateId: string
  }
}

export type DisclosedContract = {
  contractId: string
  createdEventBlob: string
  synchronizerId?: string
  templateId: string
}

export type ExecuteParams = {
  actAs: string[]
  commands: LedgerCommand[]
  disclosedContracts: DisclosedContract[]
  readAs: string[]
}

export type LedgerApi = (params: LedgerApiParams) => Promise<unknown>

export type WalletFns = {
  execute: (params: ExecuteParams) => Promise<unknown>
  ledgerApi: LedgerApi
}
