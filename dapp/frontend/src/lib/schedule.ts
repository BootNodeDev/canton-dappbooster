// Vesting math mirroring the on-ledger Schedule logic, for live figures and create-form
// validation. Keep in sync with the DAML.

import { compareAmounts, isZero, multiplyByFraction, subtractAmounts } from './amount'

export type ISO = string

export interface LinearCurve {
  kind: 'linear'
  start: ISO
  end: ISO
}

export interface MilestonePoint {
  time: ISO
  fraction: number
}

export interface MilestoneCurve {
  kind: 'milestone'
  points: MilestonePoint[]
}

export type VestingCurve = LinearCurve | MilestoneCurve

export interface VestingSchedule {
  curve: VestingCurve
  cliff: ISO
}

// Enforced floor for new grants and for re-lock remainders.
export const MIN_GRANT_AMOUNT = '1'

// Whether claiming `amount` leaves a remainder of zero or at least `MIN_GRANT_AMOUNT`, never dust
// between the two. An `amount` above `available` reads here as a full claim; the field's own `max`
// is what rejects that.
export const meetsRelockFloor = (available: string, amount: string): boolean => {
  const remainder = subtractAmounts(available, amount)
  return isZero(remainder) || compareAmounts(remainder, MIN_GRANT_AMOUNT) >= 0
}

const ms = (iso: ISO): number => new Date(iso).getTime()
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

// Fraction vested at `nowMs`, in [0, 1]: zero before the cliff, linear interpolates start to end,
// milestone steps to the cumulative fraction of the last reached point.
export const vestedFraction = (schedule: VestingSchedule, nowMs: number): number => {
  if (nowMs < ms(schedule.cliff)) {
    return 0
  }
  const curve = schedule.curve
  if (curve.kind === 'linear') {
    const start = ms(curve.start)
    const end = ms(curve.end)
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
    if (nowMs >= ms(point.time)) {
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
  const cliff = ms(schedule.cliff)
  if (Number.isNaN(cliff)) {
    return false
  }
  const curve = schedule.curve
  if (curve.kind === 'linear') {
    const start = ms(curve.start)
    const end = ms(curve.end)
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
    const t = ms(point.time)
    if (Number.isNaN(t) || t <= prevTime) {
      return false
    }
    if (point.fraction <= prevFraction || point.fraction > 1) {
      return false
    }
    prevTime = t
    prevFraction = point.fraction
  }
  const lastFraction = points[points.length - 1].fraction
  return Math.abs(lastFraction - 1) < 1e-9 && cliff <= ms(points[0].time)
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
