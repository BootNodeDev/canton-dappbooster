import { atMidnight, dateOf, inputClass, labelClass } from '@/components/CreateGrant/fields'

// One of the schedule's three labelled dates. It hands back a full ISO string, so the caller never
// sees the calendar-day form the input binds to.
export const DateField = ({
  id,
  label,
  value,
  onChange,
  className,
}: {
  className?: string
  id: string
  label: string
  onChange: (iso: string) => void
  value: string
}): React.JSX.Element => (
  <div className={className}>
    <label htmlFor={id} className={labelClass}>
      {label}
    </label>
    <input
      id={id}
      type="date"
      value={dateOf(value)}
      onChange={(e) => onChange(atMidnight(e.target.value))}
      className={inputClass}
    />
  </div>
)
