import { NumberInput } from '@ark-ui/react/number-input'
import { Trash2 } from 'lucide-react'
import { atMidnight, dateOf, inputClass, labelClass } from '@/components/CreateGrant/fields'
import { type MilestoneInput, newMilestone } from '@/components/CreateGrant/scheduleForm'
import { now } from '@/utils/clock'
import { cn } from '@/utils/cn'

interface MilestonesProps {
  className?: string
  onChange: (list: MilestoneInput[]) => void
  value: MilestoneInput[]
}

// The milestone curve's rows: a date and the cumulative percent vested by it.
export const Milestones = ({ className, onChange, value }: MilestonesProps): React.JSX.Element => {
  const setRow = (i: number, patch: Partial<MilestoneInput>): void =>
    onChange(value.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))

  return (
    <div className={className}>
      <span className={labelClass}>Milestones (date · cumulative %)</span>
      <p className="mt-1 text-xs text-fg-muted">Percentages are cumulative and must end at 100%.</p>
      <div className="mt-2 flex flex-col gap-2">
        {value.map((m, i) => (
          <div key={m.id} className="flex gap-2">
            <input
              type="date"
              aria-label={`Milestone ${i + 1} date`}
              value={dateOf(m.date)}
              onChange={(e) => setRow(i, { date: atMidnight(e.target.value) })}
              className={cn(inputClass, 'mt-0 flex-1')}
            />
            <NumberInput.Root
              className="w-20 shrink-0"
              max={100}
              min={0}
              onValueChange={(details) => setRow(i, { pct: details.value })}
              value={m.pct}
            >
              <NumberInput.Input
                aria-label={`Milestone ${i + 1} cumulative percent`}
                className={cn(inputClass, 'mt-0 font-mono')}
              />
            </NumberInput.Root>
            <button
              type="button"
              aria-label={`Remove milestone ${i + 1}`}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              disabled={value.length <= 1}
              className="grid h-11 w-9 shrink-0 place-items-center text-danger disabled:opacity-40"
            >
              <Trash2 />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, newMilestone(new Date(now()))])}
          className="self-start text-xs font-bold text-primary-strong hover:underline"
        >
          + Add milestone
        </button>
      </div>
    </div>
  )
}
