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

export type PartyId = string

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

export interface VestingView {
  claims: VestedClaim[]
  grants: Grant[]
  pendingGrants: PendingGrant[]
}

// No funder: a grant's funder is always the session's party.
export interface CreateVestInput {
  note?: string
  receiver: string
  schedule: VestingSchedule
  title: string
  totalAmount: string
}

export interface ClaimRecord {
  amount: string
  at: string
  grant: Grant
  replaces: string
}
