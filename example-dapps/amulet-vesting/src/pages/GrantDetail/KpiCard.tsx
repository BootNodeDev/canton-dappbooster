import { AmountDisplay } from '@/components/AmountDisplay'
import { Card } from '@/components/Card'
import { cn } from '@/utils/cn'

interface KpiCardProps {
  amount: string
  label: string
  lead?: boolean
}

export const KpiCard = ({ amount, label, lead = false }: KpiCardProps): React.JSX.Element => (
  <Card
    className={cn('px-5 py-4', lead && 'col-span-2 sm:col-span-1')}
    tone={lead ? 'hero' : 'plain'}
  >
    <div
      className={cn(
        'text-[0.8rem] font-semibold',
        lead ? 'text-[var(--hero-muted)]' : 'text-fg-muted',
      )}
    >
      {label}
    </div>
    <AmountDisplay
      value={amount}
      markSize="small"
      className={cn(
        'mt-2 text-[1.35rem] font-semibold tracking-tight',
        lead && 'text-[1.7rem] text-[var(--hero-figure)]',
      )}
    />
  </Card>
)
