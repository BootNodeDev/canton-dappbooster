// Vesting math — mirrors the on-ledger Schedule logic so the UI can show live
// vested / claimable figures and validate the create form before submitting.
// Keep this in sync with the on-ledger logic.

export type ISO = string

export interface LinearCurve {
  kind: 'linear'
  start: ISO
  end: ISO
}

export interface MilestonePoint {
  time: ISO
  // Cumulative fraction in (0, 1]; the last point must be exactly 1.
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
export const MIN_GRANT_AMOUNT = 1.0

const ms = (iso: ISO): number => new Date(iso).getTime()
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

// Fraction of the grant vested at `nowMs`, in [0, 1]. Returns 0 before the cliff
// (true cliff). Linear interpolates start→end; milestone is a step function that
// jumps to the cumulative fraction of the last reached point.
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

export const vestedAmount = (schedule: VestingSchedule, total: number, nowMs: number): number =>
  total * vestedFraction(schedule, nowMs)

// Mirrors validVestingSchedule: linear needs start < end and start <= cliff <= end;
// milestone needs strictly ascending times and fractions in (0, 1] ending at 1, with
// cliff at or before the first point.
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
