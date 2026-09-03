// Vesting math mirroring the on-ledger Schedule logic, for live figures and create-form
// validation. Keep in sync with the DAML.

import { compareAmounts, isZero, multiplyByFraction, subtractAmounts } from '@/utils/amount'

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

// Enforced floor for new grants and for re-lock remainders.
export const MIN_GRANT_AMOUNT = '1'

// Whether claiming `amount` leaves the escrow re-locking a remainder of zero or at least
// `MIN_GRANT_AMOUNT`, never dust between the two. An `amount` above `backing` reads here as a full
// drain; the field's own `max` is what rejects that.
export const meetsRelockFloor = (backing: string, amount: string): boolean => {
  const remainder = subtractAmounts(backing, amount)
  return isZero(remainder) || compareAmounts(remainder, MIN_GRANT_AMOUNT) >= 0
}

// The same floor on the other side of a cancel: `AmuletVestingContract_Cancel` hands the receiver
// the earned residual as a new claim, and rejects one that is neither zero nor above the floor.
export const residualMeetsFloor = (residual: string): boolean =>
  isZero(residual) || compareAmounts(residual, MIN_GRANT_AMOUNT) >= 0

export const toMs = (iso: ISO): number => new Date(iso).getTime()
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

// Fraction vested at `nowMs`, in [0, 1]: zero before the cliff, linear interpolates start to end,
// milestone steps to the cumulative fraction of the last reached point.
export const vestedFraction = (schedule: VestingSchedule, nowMs: number): number => {
  if (nowMs < toMs(schedule.cliff)) {
    return 0
  }
  const curve = schedule.curve
  if (curve.kind === 'linear') {
    const start = toMs(curve.start)
    const end = toMs(curve.end)
    if (nowMs <= start) {
      return 0
    }
    if (nowMs >= end) {
      return 1
    }
    return clamp01((nowMs - start) / (end - start))
  }
  let fraction = 0
  for (const point of curve.points) {
    if (nowMs >= toMs(point.time)) {
      fraction = point.fraction
    } else {
      break
    }
  }
  return clamp01(fraction)
}

export const vestedAmount = (schedule: VestingSchedule, total: string, nowMs: number): string =>
  multiplyByFraction(total, vestedFraction(schedule, nowMs))

// Mirrors the on-ledger validVestingSchedule: linear needs start < end and start <= cliff <= end;
// milestone needs ascending times, fractions in (0, 1] ending at 1, cliff at or before point one.
export const validVestingSchedule = (schedule: VestingSchedule): boolean => {
  const cliff = toMs(schedule.cliff)
  if (Number.isNaN(cliff)) {
    return false
  }
  const curve = schedule.curve
  if (curve.kind === 'linear') {
    const start = toMs(curve.start)
    const end = toMs(curve.end)
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return false
    }
    return start < end && start <= cliff && cliff <= end
  }
  const points = curve.points
  if (points.length === 0) {
    return false
  }
  let prevTime = Number.NEGATIVE_INFINITY
  let prevFraction = 0
  for (const point of points) {
    const t = toMs(point.time)
    if (Number.isNaN(t) || t <= prevTime) {
      return false
    }
    // A NaN fraction fails every comparison below, so without this it passes as valid and poisons
    // the ones after it. The percent field can hand one over mid-edit: "-" parses to NaN.
    if (!Number.isFinite(point.fraction) || point.fraction <= prevFraction || point.fraction > 1) {
      return false
    }
    prevTime = t
    prevFraction = point.fraction
  }
  const lastFraction = points[points.length - 1].fraction
  return Math.abs(lastFraction - 1) < 1e-9 && cliff <= toMs(points[0].time)
}

// Next future milestone (or undefined when fully past / linear).
export const nextMilestone = (
  schedule: VestingSchedule,
  nowMs: number,
): MilestonePoint | undefined => {
  if (schedule.curve.kind !== 'milestone') {
    return undefined
  }
  return schedule.curve.points.find((point) => new Date(point.time).getTime() > nowMs)
}
