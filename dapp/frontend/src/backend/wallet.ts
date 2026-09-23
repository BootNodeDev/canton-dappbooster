// The wallet-session calls the backend needs, injected as plain functions so LedgerBackend stays
// constructible outside React while the functions themselves come from canton-connect's hooks.

import type {
  DisclosedContract,
  UseExecuteResult,
  UseLedgerResult,
} from '@bootnodedev/canton-connect'

export type { DisclosedContract }

// JSON Ledger API v2 command — always an ExerciseCommand in this dApp.
export type LedgerCommand = {
  ExerciseCommand: {
    choice: string
    choiceArgument: Record<string, unknown>
    contractId: string
    templateId: string
  }
}

export type WalletFns = {
  activeContracts: UseLedgerResult['activeContracts']
  contractById: UseLedgerResult['contractById']
  execute: UseExecuteResult['execute']
  ledgerEnd: UseLedgerResult['ledgerEnd']
  transactions: UseLedgerResult['transactions']
}
