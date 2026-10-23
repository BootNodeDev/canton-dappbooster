import { randomId } from '@/utils/randomId'
import { toMs, type VestingSchedule, validVestingSchedule } from '@/utils/schedule'

export type CurveKind = 'linear' | 'milestone'

export interface MilestoneInput {
  date: string
  id: string
  pct: string
}

export interface DemoPreset {
  anchorMs: number
  durationMs: number
}

export interface ScheduleForm {
  cliff: string
  curveKind: CurveKind
  demo: DemoPreset | null
  end: string
  milestones: MilestoneInput[]
  start: string
}

const addMonths = (d: Date, m: number): Date => {
  const copy = new Date(d)
  copy.setUTCMonth(copy.getUTCMonth() + m)
  return copy
}

export const defaultSchedule = (base: Date): Omit<ScheduleForm, 'curveKind' | 'demo'> => ({
  cliff: addMonths(base, 3).toISOString(),
  end: addMonths(base, 24).toISOString(),
  milestones: [
    { id: 'm1', date: addMonths(base, 3).toISOString(), pct: '25' },
    { id: 'm2', date: addMonths(base, 9).toISOString(), pct: '60' },
    { id: 'm3', date: addMonths(base, 18).toISOString(), pct: '100' },
  ],
  start: base.toISOString(),
})

export const initialScheduleForm = (base: Date): ScheduleForm => ({
  curveKind: 'milestone',
  ...defaultSchedule(base),
  demo: null,
})

export const newMilestone = (base: Date): MilestoneInput => ({
  date: addMonths(base, 24).toISOString(),
  id: randomId(),
  pct: '100',
})

// The demo select's value: 'none' restores the real-time default, a duration in ms compresses the
// schedule into that window from the anchor.
export const applyDemoPreset = (
  current: ScheduleForm,
  value: string,
  anchorMs: number,
): ScheduleForm => {
  if (value === 'none') {
    return { curveKind: current.curveKind, ...defaultSchedule(new Date(anchorMs)), demo: null }
  }
  const durationMs = Number(value)
  const at = (ms: number): string => new Date(anchorMs + ms).toISOString()
  const step = durationMs / 3
  return {
    ...current,
    cliff: at(0),
    ...(current.curveKind === 'linear'
      ? { start: at(0), end: at(durationMs) }
      : {
          milestones: [
            { id: 'd1', date: at(step), pct: '34' },
            { id: 'd2', date: at(step * 2), pct: '67' },
            { id: 'd3', date: at(durationMs), pct: '100' },
          ],
        }),
    demo: { anchorMs, durationMs },
  }
}

// A demo window has to start when the grant is created, not when the preset was picked, so the whole
// schedule moves by however long the form stayed open. Shifting rather than rebuilding is what keeps
// a date edited by hand after the pick.
export const shiftSchedule = (schedule: VestingSchedule, byMs: number): VestingSchedule => {
  const at = (iso: string): string => new Date(toMs(iso) + byMs).toISOString()
  const curve = schedule.curve
  return {
    cliff: at(schedule.cliff),
    curve:
      curve.kind === 'linear'
        ? { kind: 'linear', start: at(curve.start), end: at(curve.end) }
        : { kind: 'milestone', points: curve.points.map((p) => ({ ...p, time: at(p.time) })) },
  }
}

export const toSchedule = ({
  cliff,
  curveKind,
  end,
  milestones,
  start,
}: ScheduleForm): VestingSchedule => {
  if (curveKind === 'linear') {
    return { cliff, curve: { kind: 'linear', start, end } }
  }
  return {
    cliff,
    curve: {
      kind: 'milestone',
      points: milestones.map((m) => ({ time: m.date, fraction: Number(m.pct) / 100 })),
    },
  }
}

export const scheduleFormValid = (form: ScheduleForm): boolean =>
  validVestingSchedule(toSchedule(form))
