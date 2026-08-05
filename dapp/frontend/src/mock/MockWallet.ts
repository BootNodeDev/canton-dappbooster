import type { PartyRef } from '@/backend/VestingBackend'
import type { Wallet } from '@/wallet/Wallet'
import { MOCK_PARTIES } from './seed'

// Party source for mock-first mode. `execute` is unreachable: MockBackend mutates its own
// in-memory state instead of submitting to a ledger.
export class MockWallet implements Wallet {
  async listParties(): Promise<PartyRef[]> {
    return MOCK_PARTIES
  }

  async execute(): Promise<unknown> {
    throw new Error('MockWallet.execute is not used in mock mode')
  }
}
