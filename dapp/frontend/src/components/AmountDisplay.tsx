import { formatAmount } from '@bootnodedev/canton-dappbooster'
import cantonCoin from '@/assets/canton-coin.png'
import { CompactAmount } from '@/components/CompactAmount'
import { InfoTip } from '@/components/InfoTip'
import { cn } from '@/utils/cn'
import { CC } from '@/utils/tokens'

interface AmountDisplayProps {
  className?: string
  count?: boolean
  gradient?: boolean
  value: string
}

// The token mark is the only thing naming the unit, so it carries the name rather than an empty alt.
const UNIT = `${CC.name} (${CC.symbol})`

// Mono numeral + the token mark. The canonical way amounts appear; `count` is for a plain tally,
// which owes neither the mark nor the forced 2 decimals.
export const AmountDisplay = ({
  value,
  className,
  count = false,
  gradient = false,
}: AmountDisplayProps): React.JSX.Element => (
  <span className={cn('font-mono tabular-nums', gradient && 'gradient-text', className)}>
    {count ? formatAmount(value) : <CompactAmount value={value} />}
    {!count && (
      <span className="ml-1.5 inline-flex align-middle">
        <InfoTip label={UNIT}>
          <img alt={UNIT} className="size-[0.92em]" src={cantonCoin} />
        </InfoTip>
      </span>
    )}
  </span>
)
