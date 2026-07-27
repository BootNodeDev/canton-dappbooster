import type { VestingSchedule } from '@/lib/schedule'

// Domain types mirror the DAML templates 1:1 so this mock store can be swapped for
// a Canton ledger / JSON-API client without touching components.

// A Canton party id (`hint::fingerprint`). Distinct from the wallet's `Party`
// object (`src/wallet/types.ts`), which carries the id plus network metadata.
export type PartyId = string

// ≙ VestingContract (the live grant). `title` is a UI label only (not on-ledger).
export interface Grant {
  id: string
  title: string
  provider: PartyId
  creator: PartyId // funder
  receiver: PartyId // beneficiary
  totalAmount: number
  schedule: VestingSchedule
  alreadyWithdrawn: number
  note?: string
}

// ≙ VestingProposal (pending offer awaiting receiver Accept).
export interface Proposal {
  id: string
  title: string
  provider: PartyId
  proposer: PartyId // funder
  receiver: PartyId
  totalAmount: number
  schedule: VestingSchedule
  note?: string
}

// ≙ VestedClaim (earned-but-unwithdrawn residual after a Cancel). No cliff/schedule.
export interface VestedClaim {
  id: string
  title: string
  provider: PartyId
  creator: PartyId
  receiver: PartyId
  amount: number
  withdrawn: number
  note?: string
}

export type Role = 'receiver' | 'funder'

// A single record of a completed withdraw, for the grant-detail history list.
export interface WithdrawEvent {
  id: string
  grantId: string
  amount: number
  at: string
}
