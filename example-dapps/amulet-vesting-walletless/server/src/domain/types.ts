// The domain types the API hands over as JSON. The frontend imports them (`@server/domain/types`),
// type-only, so a field renamed here breaks its build rather than its pages.

export type ISO = string

export interface LinearCurve {
  end: ISO
  kind: 'linear'
  start: ISO
}

export interface MilestonePoint {
  fraction: number
  time: ISO
}

export interface MilestoneCurve {
  kind: 'milestone'
  points: MilestonePoint[]
}

export type VestingCurve = LinearCurve | MilestoneCurve

export interface VestingSchedule {
  cliff: ISO
  curve: VestingCurve
}

// Domain types mirror the DAML templates 1:1, so the components never see a contract payload.

// A Canton party id (`hint::fingerprint`). A bare string on the wire.
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
export interface PendingGrant {
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

// What `GET /api/vesting` answers: everything the signed-in party is on.
export interface VestingView {
  claims: VestedClaim[]
  grants: Grant[]
  pendingGrants: PendingGrant[]
}

// The body of `POST /api/grants`; the funder is the session's party, never named here.
export interface CreateVestInput {
  note?: string
  receiver: string
  schedule: VestingSchedule
  title: string
  totalAmount: string
}

// One `AmuletVestingContract_Withdraw` off the ledger: the amount and ledger time from the
// transaction, plus the two contract ids it sits between. `replaces` is what the claim consumed and
// `grant` what it created, so a caller can walk a grant's ancestry rather than match on fields two
// grants can share.
export interface ClaimRecord {
  amount: string
  at: string
  grant: Grant
  replaces: string
}
