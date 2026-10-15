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

// The token mark is the only thing naming the unit, so it carries the name rather than an empty alt.
const UNIT = `${AMT.name} (${AMT.symbol})`

// Neither varies, so hoisting them lets React skip the subtree by element identity. The dashboard
// re-renders every amount once a second off the live clock, and each mark carries a `useId` tooltip.
// The mark scales with its figure except on a KPI, where the figures differ in size but their marks
// should not.
const mark = (size: string): React.JSX.Element => (
  <InfoTip label={UNIT}>
    <img alt={UNIT} className={size} src={cantonCoin} />
  </InfoTip>
)
const MARK = mark('size-[0.92em]')
const MARK_FIXED = mark('size-[22px]')

// Mono numeral + the token mark. The canonical way amounts appear; `count` is for a plain tally,
// which owes neither the mark nor the forced 2 decimals.
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
