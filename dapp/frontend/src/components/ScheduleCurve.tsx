import { useId, useMemo } from 'react'
import { formatDate } from '@/lib/format'
import { type VestingSchedule, vestedFraction } from '@/lib/schedule'

interface ScheduleCurveProps {
  schedule: VestingSchedule
  nowMs: number
}

const ms = (iso: string): number => new Date(iso).getTime()

const domain = (schedule: VestingSchedule): [number, number] => {
  const cliff = ms(schedule.cliff)
  if (schedule.curve.kind === 'linear') {
    return [Math.min(cliff, ms(schedule.curve.start)), ms(schedule.curve.end)]
  }
  const points = schedule.curve.points
  return [Math.min(cliff, ms(points[0].time)), ms(points[points.length - 1].time)]
}

const W = 100
const H = 56
const PAD = 2

// Vested-fraction-over-time plot. Samples vestedFraction so the cliff jump and
// milestone steps render exactly. A "now" marker tracks the live clock.
export const ScheduleCurve = ({ schedule, nowMs }: ScheduleCurveProps): React.JSX.Element => {
  const gradId = useId()

  // The curve geometry depends only on the schedule, so memoize it; the live
  // "now" marker below recomputes every tick and must stay out of the memo.
  const { x, y, start, end, d, area, cliffX, milestonePoints } = useMemo(() => {
    const [s, e] = domain(schedule)
    const span = Math.max(1, e - s)
    const px = (t: number): number => PAD + ((t - s) / span) * (W - 2 * PAD)
    const py = (f: number): number => H - PAD - f * (H - 2 * PAD)

    const samples = 160
    let path = ''
    for (let i = 0; i <= samples; i += 1) {
      const t = s + (span * i) / samples
      const f = vestedFraction(schedule, t)
      path += `${i === 0 ? 'M' : 'L'}${px(t).toFixed(2)} ${py(f).toFixed(2)} `
    }
    const fill = `${path}L${px(e).toFixed(2)} ${py(0)} L${px(s).toFixed(2)} ${py(0)} Z`
    const points =
      schedule.curve.kind === 'milestone'
        ? schedule.curve.points.map((p) => ({ x: px(ms(p.time)), y: py(p.fraction) }))
        : []
    return {
      x: px,
      y: py,
      start: s,
      end: e,
      d: path,
      area: fill,
      cliffX: px(ms(schedule.cliff)),
      milestonePoints: points,
    }
  }, [schedule])

  const nowClamped = Math.min(Math.max(nowMs, start), end)
  const nowX = x(nowClamped)
  const nowF = vestedFraction(schedule, nowMs)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
        <title>Vesting schedule curve</title>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pink)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={y(f)}
            y2={y(f)}
            stroke="var(--border)"
            strokeWidth="0.3"
          />
        ))}
        {/* cliff marker */}
        <line
          x1={cliffX}
          x2={cliffX}
          y1={PAD}
          y2={H - PAD}
          stroke="var(--fg-soft)"
          strokeWidth="0.4"
          strokeDasharray="1.4 1.4"
        />
        <path d={area} fill={`url(#${gradId})`} />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="0.9" />
        {milestonePoints.map((p) => (
          <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="1.1" fill="var(--pink)" />
        ))}
        {/* now marker */}
        <line x1={nowX} x2={nowX} y1={PAD} y2={H - PAD} stroke="var(--primary)" strokeWidth="0.5" />
        <circle
          cx={nowX}
          cy={y(nowF)}
          r="1.5"
          fill="var(--primary)"
          stroke="var(--surface)"
          strokeWidth="0.5"
        />
      </svg>
      <div className="mt-1.5 flex justify-between font-mono text-[0.7rem] text-fg-muted">
        <span>{formatDate(new Date(start).toISOString())}</span>
        <span className="text-fg-soft">cliff {formatDate(schedule.cliff)}</span>
        <span>{formatDate(new Date(end).toISOString())}</span>
      </div>
    </div>
  )
}
