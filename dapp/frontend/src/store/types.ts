import type { VestingSchedule } from '@/utils/schedule'

// Domain types mirror the DAML templates 1:1, so the components never see a contract payload.

// A Canton party id (`hint::fingerprint`). Distinct from `canton-connect`'s `Party`, which carries
// the id plus network metadata.
export type PartyId = string

// Amounts are decimal strings: they are Daml Numeric, and a double loses 10 dp past six integer
// digits.

// ≙ VestingContract (the live grant). `creator` is the DAML funder and `receiver` the
// beneficiary; `title` is a UI label only, never on-ledger.
export interface Grant {
  alreadyWithdrawn: string
  creator: PartyId
  id: string
  note?: string
  provider: PartyId
  receiver: PartyId
  schedule: VestingSchedule
  title: string
  totalAmount: string
}

// ≙ VestingProposal (pending offer awaiting receiver Accept); the proposer is the funder.
export interface Proposal {
  id: string
  note?: string
  proposer: PartyId
  provider: PartyId
  receiver: PartyId
  schedule: VestingSchedule
  title: string
  totalAmount: string
}

// ≙ VestedClaim (earned-but-unwithdrawn residual after a Cancel). No cliff/schedule.
export interface VestedClaim {
  amount: string
  creator: PartyId
  id: string
  note?: string
  provider: PartyId
  receiver: PartyId
  title: string
  withdrawn: string
}

export type Role = 'receiver' | 'funder'
