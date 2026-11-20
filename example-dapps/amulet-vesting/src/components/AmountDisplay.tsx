import { formatAmount } from '@bootnodedev/canton-dappbooster'
import cantonCoin from '@/assets/canton-coin.png'
import { CompactAmount } from '@/components/CompactAmount'
import { InfoTip } from '@/components/InfoTip'
import { cn } from '@/utils/cn'
import { AMT } from '@/utils/tokens'

type MarkSize = 'relative' | 'small'

interface AmountDisplayProps {
  className?: string
  count?: boolean
  markSize?: MarkSize
  value: string
}

// The token mark is the only thing naming the unit, so it carries the name rather than an empty alt.
const UNIT = `${AMT.name} (${AMT.symbol})`

// Hoisted so React skips them by identity: every amount re-renders each second, each mark a tooltip.
const mark = (size: string): React.JSX.Element => (
  <InfoTip label={UNIT}>
    <img alt={UNIT} className={size} src={cantonCoin} />
  </InfoTip>
)
const MARKS: Record<MarkSize, React.JSX.Element> = {
  relative: mark('size-[0.92em]'),
  small: mark('size-[0.7em]'),
}

// `count` is for a plain tally, which owes neither the mark nor the forced two decimals.
export const AmountDisplay = ({
  value,
  className,
  count = false,
  markSize = 'relative',
}: AmountDisplayProps): React.JSX.Element => (
  <span className={cn('inline-flex items-center gap-[0.3em] font-num tabular-nums', className)}>
    {count ? formatAmount(value) : <CompactAmount value={value} />}
    {!count && MARKS[markSize]}
  </span>
)
