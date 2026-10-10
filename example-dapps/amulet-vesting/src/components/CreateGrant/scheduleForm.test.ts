import { describe, expect, it } from 'vitest'
import {
  applyDemoPreset,
  defaultSchedule,
  initialScheduleForm,
  type ScheduleForm,
  shiftSchedule,
  toSchedule,
} from '@/components/CreateGrant/scheduleForm'
import { validVestingSchedule } from '@/utils/schedule'

const PICKED = new Date('2025-01-01T00:00:00.000Z').getTime()
const SUBMITTED = new Date('2025-01-01T00:10:00.000Z').getTime()

const form = (patch: Partial<ScheduleForm> = {}): ScheduleForm => ({
  curveKind: 'linear',
  ...defaultSchedule(new Date(PICKED)),
  demo: null,
  ...patch,
})

describe('initialScheduleForm', () => {
  it('opens on the milestone curve with no preset', () => {
    const initial = initialScheduleForm(new Date(PICKED))

    expect(initial.curveKind).toBe('milestone')
    expect(initial.demo).toBeNull()
    expect(validVestingSchedule(toSchedule(initial))).toBe(true)
  })

  it('spaces the default dates out in calendar months', () => {
    const initial = initialScheduleForm(new Date('2025-01-15T00:00:00.000Z'))

    expect(initial.start).toBe('2025-01-15T00:00:00.000Z')
    expect(initial.cliff).toBe('2025-04-15T00:00:00.000Z')
    expect(initial.end).toBe('2027-01-15T00:00:00.000Z')
  })
})

describe('applyDemoPreset', () => {
  it('compresses a linear form into the picked window and records the preset', () => {
    const next = applyDemoPreset(form(), '120000', PICKED)

    expect(next.demo).toEqual({ anchorMs: PICKED, durationMs: 120_000 })
    expect(next.cliff).toBe('2025-01-01T00:00:00.000Z')
    expect(next.start).toBe('2025-01-01T00:00:00.000Z')
    expect(next.end).toBe('2025-01-01T00:02:00.000Z')
    expect(validVestingSchedule(toSchedule(next))).toBe(true)
  })

  it('anchors the window to the time the preset is picked, not to the form', () => {
    const next = applyDemoPreset(form(), '60000', SUBMITTED)

    expect(next.cliff).toBe('2025-01-01T00:10:00.000Z')
    expect(next.start).toBe('2025-01-01T00:10:00.000Z')
    expect(next.end).toBe('2025-01-01T00:11:00.000Z')
  })

  it('rewrites the milestone rows from the preset points', () => {
    const next = applyDemoPreset(form({ curveKind: 'milestone' }), '300000', PICKED)

    expect(next.milestones).toEqual([
      { id: 'd1', date: '2025-01-01T00:01:40.000Z', pct: '34' },
      { id: 'd2', date: '2025-01-01T00:03:20.000Z', pct: '67' },
      { id: 'd3', date: '2025-01-01T00:05:00.000Z', pct: '100' },
    ])
    expect(validVestingSchedule(toSchedule(next))).toBe(true)
  })

  it('drops the preset and restores the real-time default on none', () => {
    const demo = applyDemoPreset(form(), '60000', PICKED)
    const next = applyDemoPreset(demo, 'none', SUBMITTED)

    expect(next.demo).toBeNull()
    expect(next).toEqual({
      curveKind: 'linear',
      ...defaultSchedule(new Date(SUBMITTED)),
      demo: null,
    })
  })

  it('keeps the curve the form is on when the default is restored', () => {
    const next = applyDemoPreset(form({ curveKind: 'milestone' }), 'none', PICKED)

    expect(next.curveKind).toBe('milestone')
  })
})

describe('shiftSchedule', () => {
  it('re-anchors a demo preset to submit time, keeping the window it was picked with', () => {
    const picked = applyDemoPreset(form(), '60000', PICKED)

    const sent = shiftSchedule(toSchedule(picked), SUBMITTED - PICKED)

    expect(sent).toEqual({
      cliff: '2025-01-01T00:10:00.000Z',
      curve: {
        kind: 'linear',
        start: '2025-01-01T00:10:00.000Z',
        end: '2025-01-01T00:11:00.000Z',
      },
    })
  })

  it('carries a date edited after the pick, rather than rebuilding over it', () => {
    const picked = applyDemoPreset(form({ curveKind: 'milestone' }), '300000', PICKED)
    const edited = {
      ...picked,
      milestones: picked.milestones.map((m, i) => (i === 1 ? { ...m, pct: '80' } : m)),
    }

    const sent = shiftSchedule(toSchedule(edited), SUBMITTED - PICKED)

    expect(sent.curve).toEqual({
      kind: 'milestone',
      points: [
        { time: '2025-01-01T00:11:40.000Z', fraction: 0.34 },
        { time: '2025-01-01T00:13:20.000Z', fraction: 0.8 },
        { time: '2025-01-01T00:15:00.000Z', fraction: 1 },
      ],
    })
  })
})
