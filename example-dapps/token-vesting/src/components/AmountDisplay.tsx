import { formatAmount } from '@bootnodedev/canton-dappbooster'
import { CompactAmount } from '@/components/CompactAmount'
import { InfoTip } from '@/components/InfoTip'
import { TokenMark } from '@/icons'
import { cn } from '@/utils/cn'
import { DBT } from '@/utils/tokens'

type MarkSize = 'fixed' | 'relative' | 'small'

interface AmountDisplayProps {
  className?: string
  count?: boolean
  gradient?: boolean
  markSize?: MarkSize
  value: string
}

// The token mark is the only thing naming the unit, so it carries the name rather than an empty alt.
const UNIT = `${DBT.name} (${DBT.symbol})`

// Hoisted so React skips them by identity: every amount re-renders each second, each mark a tooltip.
// InfoTip names no element child, so the mark carries role="img" and drops its default aria-hidden.
const mark = (size: string): React.JSX.Element => (
  <InfoTip label={UNIT}>
    <TokenMark role="img" aria-label={UNIT} aria-hidden={undefined} className={size} />
  </InfoTip>
)
const MARKS: Record<MarkSize, React.JSX.Element> = {
  fixed: mark('size-[22px]'),
  relative: mark('size-[0.92em]'),
  small: mark('size-[0.7em]'),
}

// `count` is for a plain tally, which owes neither the mark nor the forced two decimals.
export const AmountDisplay = ({
  value,
  className,
  count = false,
  gradient = false,
  markSize = 'relative',
}: AmountDisplayProps): React.JSX.Element => (
  <span
    className={cn(
      'inline-flex items-center gap-[0.3em] font-num tabular-nums',
      gradient && 'gradient-text',
      className,
    )}
  >
    {count ? formatAmount(value) : <CompactAmount value={value} />}
    {!count && MARKS[markSize]}
  </span>
)
