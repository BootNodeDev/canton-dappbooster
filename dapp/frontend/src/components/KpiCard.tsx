import { cn } from '@/lib/cn'
import { AmountDisplay } from './AmountDisplay'

interface KpiCardProps {
  label: string
  amount: number
  unit?: string
  sub?: string
  subTone?: 'muted' | 'success'
  // Aurora hero treatment for the headline metric (Claimable now).
  hero?: boolean
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
      'relative overflow-hidden rounded-2xl border p-5',
      hero
        ? 'border-accent/35 bg-[image:linear-gradient(135deg,color-mix(in_oklab,var(--primary)_30%,transparent),color-mix(in_oklab,var(--pink)_16%,transparent))] shadow-[var(--shadow-card)]'
        : 'border-border bg-surface shadow-[var(--shadow-card)]',
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
    {hero && (
      <span className="pointer-events-none absolute -bottom-10 -right-8 size-36 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--pink)_40%,transparent),transparent_70%)] blur-md" />
    )}
  </div>
)
