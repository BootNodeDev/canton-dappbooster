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

export const MIN_GRANT_AMOUNT = '1'

export const meetsRelockFloor = (backing: string, amount: string): boolean => {
  const remainder = subtractAmounts(backing, amount)
  return isZero(remainder) || compareAmounts(remainder, MIN_GRANT_AMOUNT) >= 0
}

export const residualMeetsFloor = (residual: string): boolean =>
  isZero(residual) || compareAmounts(residual, MIN_GRANT_AMOUNT) >= 0

export const toMs = (iso: ISO): number => new Date(iso).getTime()
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

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
    if (!Number.isFinite(point.fraction) || point.fraction <= prevFraction || point.fraction > 1) {
      return false
    }
    prevTime = t
    prevFraction = point.fraction
  }
  const lastFraction = points[points.length - 1].fraction
  return Math.abs(lastFraction - 1) < 1e-9 && cliff <= toMs(points[0].time)
}

export const nextMilestone = (
  schedule: VestingSchedule,
  nowMs: number,
): MilestonePoint | undefined => {
  if (schedule.curve.kind !== 'milestone') {
    return undefined
  }
  return schedule.curve.points.find((point) => new Date(point.time).getTime() > nowMs)
}
