import { AmountDisplay } from '@/components/AmountDisplay'
import { Card } from '@/components/Card'
import { cn } from '@/utils/cn'

interface KpiCardProps {
  amount: string
  label: string
  lead?: boolean
  tone?: 'muted' | 'success'
}

const TONES: Record<'muted' | 'success', string> = {
  muted: 'text-fg-muted',
  success: 'text-success',
}

export const KpiCard = ({ amount, label, lead = false, tone }: KpiCardProps): React.JSX.Element => (
  <Card
    className={cn(
      'px-5 py-4',
      lead &&
        'col-span-2 border-[var(--hero-border)] bg-[image:var(--hero-bg)] text-[var(--hero-fg)] shadow-[var(--hero-shadow)] sm:col-span-1',
    )}
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
        tone !== undefined && TONES[tone],
      )}
    />
  </Card>
)
