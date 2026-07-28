import { cn } from '@/lib/cn'

interface ScheduleBarProps {
  // Fractions of the grant total, in [0, 1].
  vestedFraction: number
  claimedFraction: number
  // Optional milestone marks (cumulative fractions) drawn as ticks.
  milestones?: number[]
  className?: string
}

const pct = (f: number): string => `${Math.max(0, Math.min(1, f)) * 100}%`

// Stacked bar: brand gradient = vested, solid success sub-segment = claimable
// (vested minus claimed), remainder = unvested. Ticks mark milestone points.
export const ScheduleBar = ({
  vestedFraction,
  claimedFraction,
  milestones,
  className,
}: ScheduleBarProps): React.JSX.Element => {
  const claimableWidth = Math.max(0, vestedFraction - claimedFraction)
  return (
    <div
      className={cn(
        'relative h-2.5 overflow-hidden rounded-full border border-border bg-surface-2',
        className,
      )}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-[image:var(--gradient-brand)]"
        style={{ width: pct(vestedFraction) }}
      />
      <span
        className="absolute inset-y-0 rounded-full bg-success"
        style={{ left: pct(claimedFraction), width: pct(claimableWidth) }}
      />
      {milestones?.map((m) => (
        <span
          key={m}
          className="absolute top-[-2px] h-[14px] w-0.5 bg-fg/45"
          style={{ left: pct(m) }}
        />
      ))}
    </div>
  )
}
