// The two wallet-session calls, injected so LedgerBackend is constructible outside React.

import type { PrepareExecuteParams } from '@bootnodedev/canton-connect'
import type { LedgerApi } from '@/backend/acs'

export type LedgerCommand =
  | {
      CreateCommand: {
        createArguments: Record<string, unknown>
        templateId: string
      }
    }
  | {
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

export type WalletFns = {
  execute: (params: PrepareExecuteParams) => Promise<unknown>
  ledgerApi: LedgerApi
}
