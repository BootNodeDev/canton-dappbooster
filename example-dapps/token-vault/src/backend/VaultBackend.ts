// The seam the UI depends on, with no mention of the JSON API or the wallet.

import type { Holding } from '@bootnodedev/canton-dappbooster'
import type { RequestKind } from '@/backend/commands'
import type { VaultProposal, VaultRequest, VaultRequests } from '@/backend/requests'

export interface VaultBackend {
  allocate: (partyId: string, request: VaultRequest) => Promise<void>
  cancelProposal: (partyId: string, proposal: VaultProposal) => Promise<void>
  holdingsOf: (partyId: string) => Promise<readonly Holding[]>
  propose: (partyId: string, kind: RequestKind, amount: string) => Promise<void>
  requestsOf: (partyId: string) => Promise<VaultRequests>
  tap: (partyId: string) => Promise<void>
}
