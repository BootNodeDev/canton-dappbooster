import { Copyable } from '@/components/ui/Copyable'

interface DetailRowProps {
  label: string
  value: string
  copyLabel?: string
  copyTestId?: string
}

// Label/value pair for the detail sheets: a copy control sits by the title and the value
// renders in a framed box. copyLabel overrides the copy button's accessible label.
export const DetailRow = ({ label, value, copyLabel, copyTestId }: DetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <div className="flex items-center gap-1.5">
      <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
      <Copyable
        value={value}
        label={copyLabel ?? label}
        testId={copyTestId}
      />
    </div>
    <dd className="m-0 break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-[0.74rem] leading-5 text-foreground">
      {value}
    </dd>
  </div>
)
