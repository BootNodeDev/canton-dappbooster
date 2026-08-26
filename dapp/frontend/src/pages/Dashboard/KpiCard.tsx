import { AmountDisplay } from '@/components/AmountDisplay'
import { cn } from '@/utils/cn'

interface KpiCardProps {
  amount: string
  hero?: boolean
  label: string
  sub?: string
  subTone?: 'muted' | 'success'
  unit?: string
}

export const KpiCard = ({
  label,
  amount,
  unit = 'CC',
  sub,
  subTone = 'muted',
  hero = false,
}: KpiCardProps): React.JSX.Element => (
  <div
    className={cn(
      'rounded-[12px] border bg-surface p-5 shadow-[var(--shadow-card)]',
      hero ? 'border-accent/35' : 'border-border',
    )}
  >
    <div className="mb-3 text-xs font-semibold text-fg-muted">{label}</div>
    <AmountDisplay
      value={amount}
      unit={unit}
      gradient={hero}
      className={cn('text-[1.7rem] font-semibold tracking-tight', hero && 'text-[1.9rem]')}
    />
    {sub !== undefined && (
      <div
        className={cn(
          'mt-1.5 text-xs',
          subTone === 'success' ? 'font-semibold text-success' : 'text-fg-muted',
        )}
      >
        {sub}
      </div>
    )}
  </div>
)
