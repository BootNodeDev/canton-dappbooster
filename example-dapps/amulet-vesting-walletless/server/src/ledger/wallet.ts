// The two ledger calls the backend needs, injected as plain functions so LedgerBackend stays
// constructible without a network. A wallet dApp takes them off a wallet session; here
// `client.ts` makes them straight against the JSON Ledger API, as the signed-in user.

// A JSON Ledger API v2 request, in the shape the CIP-0103 `ledgerApi` call takes: `path` fills the
// `{name}` placeholders in `resource`, `query` becomes the search string.
export type LedgerApiParams = {
  body?: unknown
  path?: Record<string, string>
  query?: Record<string, string | number | boolean>
  requestMethod: 'get' | 'post' | 'put' | 'patch' | 'delete'
  resource: string
}

// JSON Ledger API v2 command — always an ExerciseCommand in this dApp.
export type LedgerCommand = {
  ExerciseCommand: {
    choice: string
    choiceArgument: Record<string, unknown>
    contractId: string
    templateId: string
  }
}

// Explicitly-disclosed contract (JSON Ledger API v2 disclosedContracts entry).
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

export type WalletFns = {
  execute: (params: ExecuteParams) => Promise<unknown>
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>
}
