import type { VestingSchedule } from '@/lib/schedule'

// Domain types mirror the DAML templates 1:1 so this mock store can be swapped for
// a Canton ledger / JSON-API client without touching components.

// A Canton party id (`hint::fingerprint`). Distinct from the wallet's `Party`
// object (`src/wallet/types.ts`), which carries the id plus network metadata.
export type PartyId = string

// Amounts are decimal strings: they are Daml Numeric, and a double loses 10 dp past six integer
// digits.

// ≙ VestingContract (the live grant). `creator` is the DAML funder and `receiver` the
// beneficiary; `title` is a UI label only, never on-ledger.
export interface Grant {
  id: string
  title: string
  provider: PartyId
  creator: PartyId
  receiver: PartyId
  totalAmount: string
  schedule: VestingSchedule
  alreadyWithdrawn: string
  note?: string
}

// ≙ VestingProposal (pending offer awaiting receiver Accept); the proposer is the funder.
export interface Proposal {
  id: string
  title: string
  provider: PartyId
  proposer: PartyId
  receiver: PartyId
  totalAmount: string
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
  amount: string
  withdrawn: string
  note?: string
}

export type Role = 'receiver' | 'funder'

// A single record of a completed withdraw, for the grant-detail history list.
export interface WithdrawEvent {
  id: string
  grantId: string
  amount: string
  at: string
}
