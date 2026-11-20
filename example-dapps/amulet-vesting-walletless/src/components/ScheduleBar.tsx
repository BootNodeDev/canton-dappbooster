import { Progress } from '@ark-ui/react/progress'

interface ScheduleBarProps {
  claimedFraction: number
  className?: string
  milestones?: number[]
  vestedFraction: number
}

const clamp = (f: number): number => Math.max(0, Math.min(1, f))

const translations = {
  value: ({ percent }: { percent: number }) => `${Math.round(percent)}% vested`,
}
const pct = (f: number): string => `${clamp(f) * 100}%`

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
      <Progress.Track className="relative h-2.5 overflow-hidden rounded-full bg-[var(--bar-track)]">
        <Progress.Range className="absolute inset-y-0 left-0 bg-[var(--bar-claimed)]" />
        <span
          className="absolute inset-y-0 [background:var(--bar-claimable)]"
          style={{ left: pct(claimedFraction), width: pct(claimableWidth) }}
        />
        {milestones
          ?.filter((m) => m < 1)
          .map((m) => (
            <span
              key={m}
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-surface"
              style={{ left: pct(m) }}
            />
          ))}
      </Progress.Track>
    </Progress.Root>
  )
}
