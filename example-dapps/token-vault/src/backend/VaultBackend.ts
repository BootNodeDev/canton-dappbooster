// The seam the UI depends on, with no mention of the JSON API or the wallet.

import type { Holding } from '@bootnodedev/canton-dappbooster'
import type { VaultProposal, VaultRequest, VaultRequests } from '@/backend/requests'

export interface VaultBackend {
  allocate: (partyId: string, request: VaultRequest) => Promise<void>
  cancelProposal: (partyId: string, proposal: VaultProposal) => Promise<void>
  deposit: (partyId: string, amount: string) => Promise<void>
  holdingsOf: (partyId: string) => Promise<readonly Holding[]>
  requestsOf: (partyId: string) => Promise<VaultRequests>
  tap: (partyId: string) => Promise<void>
  withdraw: (partyId: string, amount: string) => Promise<void>
}
