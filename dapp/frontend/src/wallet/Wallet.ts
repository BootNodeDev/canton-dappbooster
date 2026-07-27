// Party discovery + submission seam. StealthWallet (hosted) implements it today;
// CarpinchoWallet (external keys) slots in later without touching the dApp.
import type { PartyRef } from '@/backend/VestingBackend'

// JSON Ledger API v2 command — always an ExerciseCommand in this dApp.
export type LedgerCommand = {
  ExerciseCommand: {
    templateId: string
    contractId: string
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

// Explicitly-disclosed contract (JSON Ledger API v2 disclosedContracts entry).
export type DisclosedContract = {
  templateId: string
  contractId: string
  createdEventBlob: string
  synchronizerId?: string
}

export interface Wallet {
  listParties(): Promise<PartyRef[]>
  execute(
    actingParty: string,
    command: LedgerCommand,
    disclosed?: DisclosedContract[],
  ): Promise<unknown>
}
