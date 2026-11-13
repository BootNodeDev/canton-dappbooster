import { AmountDisplay } from '@/components/AmountDisplay'
import { Card } from '@/components/Card'
import { cn } from '@/utils/cn'

interface KpiCardProps {
  amount: string
  count?: boolean
  hero?: boolean
  label: string
  sub?: string
  subTone?: 'muted' | 'success'
  tone?: 'muted' | 'success'
}

const TONES: Record<'muted' | 'success', string> = {
  muted: 'text-fg-muted',
  success: 'text-success',
}

export const KpiCard = ({
  label,
  amount,
  count = false,
  sub,
  subTone = 'muted',
  tone,
  hero = false,
}: KpiCardProps): React.JSX.Element => (
  <Card className={cn('p-5', hero && 'border-accent/35')}>
    <div className="mb-3 text-xs font-semibold text-fg-muted">{label}</div>
    <AmountDisplay
      value={amount}
      count={count}
      fixedMark
      gradient={hero}
      className={cn(
        'text-[1.7rem] font-semibold tracking-tight',
        hero && 'text-[1.9rem]',
        tone !== undefined && TONES[tone],
      )}
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
  </Card>
)
