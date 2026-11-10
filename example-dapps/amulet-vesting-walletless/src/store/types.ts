// The domain types are the server's, imported type-only: the API hands them over as JSON, so one
// definition keeps a renamed field a build error on both sides.
export type {
  Grant,
  ISO,
  MilestonePoint,
  PartyId,
  PendingGrant,
  VestedClaim,
  VestingCurve,
  VestingSchedule,
} from '#server/domain/types'

export type Role = 'receiver' | 'funder'
