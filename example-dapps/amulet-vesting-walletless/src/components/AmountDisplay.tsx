import { formatAmount } from '@bootnodedev/canton-dappbooster'
import cantonCoin from '@/assets/canton-coin.png'
import { CompactAmount } from '@/components/CompactAmount'
import { InfoTip } from '@/components/InfoTip'
import { cn } from '@/utils/cn'
import { AMT } from '@/utils/tokens'

interface AmountDisplayProps {
  className?: string
  count?: boolean
  fixedMark?: boolean
  gradient?: boolean
  value: string
}

// The mark is the only thing naming the unit, so it carries the name rather than an empty alt.
const UNIT = `${AMT.name} (${AMT.symbol})`

const mark = (size: string): React.JSX.Element => (
  <InfoTip label={UNIT}>
    <img alt={UNIT} className={size} src={cantonCoin} />
  </InfoTip>
)
// Hoisted so the dashboard's once-a-second re-render skips each mark's tooltip subtree.
const MARK = mark('size-[0.92em]')
const MARK_FIXED = mark('size-[22px]')

export const AmountDisplay = ({
  value,
  className,
  count = false,
  fixedMark = false,
  gradient = false,
}: AmountDisplayProps): React.JSX.Element => (
  <span
    className={cn(
      'inline-flex items-center gap-2 font-mono tabular-nums',
      gradient && 'gradient-text',
      className,
    )}
  >
    {count ? formatAmount(value) : <CompactAmount value={value} />}
    {!count && (fixedMark ? MARK_FIXED : MARK)}
  </span>
)
