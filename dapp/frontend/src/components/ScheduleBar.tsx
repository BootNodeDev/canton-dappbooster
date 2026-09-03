import { Progress } from '@ark-ui/react/progress'

interface ScheduleBarProps {
  claimedFraction: number
  className?: string
  milestones?: number[]
  vestedFraction: number
}

const clamp = (f: number): number => Math.max(0, Math.min(1, f))

// Hoisted: every row rebuilds this on each clock tick otherwise.
const translations = {
  value: ({ percent }: { percent: number }) => `${Math.round(percent)}% vested`,
}
const pct = (f: number): string => `${clamp(f) * 100}%`

// Stacked bar over fractions of the grant total in [0, 1]: brand gradient is vested, the solid
// success sub-segment claimable, the remainder unvested. Ticks mark milestones, also cumulative
// fractions. The vested share is the value a screen reader is given.
export const ScheduleBar = ({
  vestedFraction,
  claimedFraction,
  milestones,
  className,
}: ScheduleBarProps): React.JSX.Element => {
  const claimableWidth = Math.max(0, vestedFraction - claimedFraction)
  return (
    <Progress.Root
      className={className}
      translations={translations}
      value={clamp(vestedFraction) * 100}
    >
      <Progress.Track className="relative h-2.5 overflow-hidden rounded-full border border-border bg-surface-2">
        <Progress.Range className="absolute inset-y-0 left-0 rounded-full bg-[image:var(--gradient-brand)]" />
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
      </Progress.Track>
    </Progress.Root>
  )
}
