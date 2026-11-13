import { formatFigure } from '@bootnodedev/canton-dappbooster'
import { InfoTip } from '@/components/InfoTip'
import { cn } from '@/utils/cn'
import type { VaultToken } from '@/utils/tokens'

export const AmountDisplay = ({
  className,
  token,
  value,
}: {
  className?: string
  token: VaultToken
  value: string
}): React.JSX.Element => {
  const unit = `${token.name} (${token.symbol})`

  return (
    <span className={cn('inline-flex items-center gap-2 font-mono tabular-nums', className)}>
      {formatFigure(value) ?? 'N/A'}
      {/* InfoTip names no element child, so the mark carries its own name and drops aria-hidden. */}
      <InfoTip label={unit}>
        <token.Mark
          role="img"
          aria-label={unit}
          aria-hidden={undefined}
          className="size-[0.92em]"
        />
      </InfoTip>
    </span>
  )
}
