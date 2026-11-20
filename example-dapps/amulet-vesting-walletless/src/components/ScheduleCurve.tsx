import { useCallback, useId, useMemo, useState } from 'react'
import type { VestingSchedule } from '@/store/types'
import { cn } from '@/utils/cn'
import { formatDate, formatPct } from '@/utils/format'
import { toMs, vestedFraction } from '@/utils/schedule'

interface ScheduleCurveProps {
  compact?: boolean
  nowMs: number
  schedule: VestingSchedule
}

const domain = (schedule: VestingSchedule): [number, number] => {
  const cliff = toMs(schedule.cliff)
  if (schedule.curve.kind === 'linear') {
    return [Math.min(cliff, toMs(schedule.curve.start)), toMs(schedule.curve.end)]
  }
  const points = schedule.curve.points
  return [Math.min(cliff, toMs(points[0].time)), toMs(points[points.length - 1].time)]
}

const tickDates = (schedule: VestingSchedule): string[] =>
  schedule.curve.kind === 'linear'
    ? [schedule.curve.start, schedule.cliff, schedule.curve.end]
    : schedule.curve.points.map((point) => point.time)

// A date label is about this wide (px); one closer than that to the next gives way.
const TICK_WIDTH = 76

const clamp = (value: number): number => Math.min(100, Math.max(0, value))

// Strokes stay in pixels and every label is HTML, so the stretched 100 by 100 plot distorts neither.
export const ScheduleCurve = ({
  compact = false,
  nowMs,
  schedule,
}: ScheduleCurveProps): React.JSX.Element => {
  const gradId = useId()
  const clipId = useId()
  const titleId = useId()

  // The geometry depends only on the schedule; the marker below recomputes every tick of the clock.
  const { area, d, end, start, ticks } = useMemo(() => {
    const [s, e] = domain(schedule)
    const span = Math.max(1, e - s)
    const px = (t: number): number => ((t - s) / span) * 100

    const samples = 800
    let path = ''
    for (let i = 0; i <= samples; i += 1) {
      const t = s + (span * i) / samples
      path += `${i === 0 ? 'M' : 'L'}${px(t).toFixed(2)} ${(100 - vestedFraction(schedule, t) * 100).toFixed(2)} `
    }

    const ticks = tickDates(schedule).map((iso) => ({ iso, x: clamp(px(toMs(iso))) }))

    return { area: `${path}L100 100 L0 100 Z`, d: path, end: e, start: s, ticks }
  }, [schedule])

  const [width, setWidth] = useState(0)
  const measure = useCallback((row: HTMLDivElement | null) => {
    if (row === null) {
      return undefined
    }
    const observer = new ResizeObserver(() => setWidth(row.clientWidth))
    observer.observe(row)
    return () => observer.disconnect()
  }, [])
  const gap = width > 0 ? (TICK_WIDTH / width) * 100 : 100
  let last = Number.POSITIVE_INFINITY
  const kept = [...ticks]
    .reverse()
    .filter(({ x }) => {
      const fits = last - x >= gap
      if (fits) {
        last = x
      }
      return fits
    })
    .reverse()

  const nowX = clamp(((nowMs - start) / Math.max(1, end - start)) * 100)
  const nowF = vestedFraction(schedule, nowMs)
  const reach = compact ? 100 : nowX

  return (
    <div>
      <div className={cn('flex gap-3', !compact && 'mt-7')}>
        {!compact && (
          <div
            aria-hidden="true"
            className="-my-2 flex w-9 flex-col justify-between text-right text-[0.7rem] text-fg-soft"
          >
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
        )}
        <div className={cn('relative flex-1', compact ? 'h-32' : 'h-52 sm:h-60')}>
          {/* A bare <title> is announced inconsistently, so role and aria-labelledby name it too. */}
          <svg
            aria-labelledby={titleId}
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            viewBox="0 0 100 100"
          >
            <title id={titleId}>
              Vested fraction from {formatDate(new Date(start).toISOString())} to{' '}
              {formatDate(new Date(end).toISOString())}, {formatPct(nowF)} vested now
            </title>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-fill)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity="0.02" />
              </linearGradient>
              <clipPath id={clipId}>
                <rect x="-1" y="-5" width={reach + 1} height="110" />
              </clipPath>
            </defs>
            {[0, 50, 100].map((y) => (
              <line
                key={y}
                stroke="var(--border)"
                strokeDasharray={y === 100 ? undefined : '3 4'}
                vectorEffect="non-scaling-stroke"
                x1="0"
                x2="100"
                y1={y}
                y2={y}
              />
            ))}
            <path clipPath={`url(#${clipId})`} d={area} fill={`url(#${gradId})`} />
            {!compact && (
              <path
                d={d}
                fill="none"
                opacity="0.55"
                stroke="var(--chart-line)"
                strokeDasharray="5 5"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path
              clipPath={`url(#${clipId})`}
              d={d}
              fill="none"
              stroke="var(--chart-line)"
              strokeLinejoin="round"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
            {!compact && (
              <line
                stroke="var(--fg-soft)"
                strokeDasharray="2 3"
                vectorEffect="non-scaling-stroke"
                x1={nowX}
                x2={nowX}
                y1="0"
                y2="100"
              />
            )}
          </svg>
          {!compact && (
            <>
              <span
                aria-hidden="true"
                className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-[var(--chart-line)] bg-surface"
                style={{ left: `${nowX}%`, top: `${100 - nowF * 100}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute top-0 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-full bg-fg px-2 py-0.5 text-[0.65rem] font-bold text-bg"
                style={{ left: `${nowX}%` }}
              >
                Today
              </span>
            </>
          )}
        </div>
      </div>
      <div
        aria-hidden="true"
        className={cn('relative mt-2 h-4 text-[0.7rem] text-fg-soft', !compact && 'ml-12')}
        ref={measure}
      >
        {kept.map(({ iso, x }) => (
          <span
            className="absolute whitespace-nowrap"
            key={iso}
            style={{
              left: `${x}%`,
              transform: `translateX(${x < 8 ? '0' : x > 92 ? '-100%' : '-50%'})`,
            }}
          >
            {formatDate(iso)}
          </span>
        ))}
      </div>
    </div>
  )
}
