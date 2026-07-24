import cantonIcon from '@/assets/canton.png'
import { formatTokenAmount } from '@/cip56/amount'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { CHEVRON_RIGHT_ICON, LOCK_ICON } from '@/components/ui/icons'

interface TokenRowProps {
  summary: TokenHoldingSummary
  onOpen: () => void
}

// One token in the assets list: icon + amount with the token name beneath, chevron right; opens the detail modal.
export const TokenRow = ({ summary, onOpen }: TokenRowProps): JSX.Element => {
  const hasLocked = (summary.lockedCount ?? 0) > 0
  return (
    <button
      type="button"
      data-testid="token-row"
      data-token-label={summary.tokenLabel}
      onClick={onOpen}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left outline-none transition-colors hover:border-primary/60 hover:bg-primary-soft/40 focus-visible:shadow-focus"
    >
      <img
        src={cantonIcon}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="size-9 shrink-0 rounded-full"
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-mono text-[0.95rem] font-semibold text-foreground">
          {formatTokenAmount(summary.totalAmount)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[0.82rem] font-medium text-muted-foreground">
            {summary.tokenLabel}
          </span>
          {hasLocked ? (
            <span
              role="img"
              className="shrink-0 text-warning"
              title="Some holdings are locked"
              aria-label="Some holdings are locked"
            >
              {LOCK_ICON}
            </span>
          ) : null}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="justify-self-end text-muted-foreground"
      >
        {CHEVRON_RIGHT_ICON}
      </span>
    </button>
  )
}
