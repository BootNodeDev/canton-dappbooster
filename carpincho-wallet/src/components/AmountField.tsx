import { formatAmountInput, formatTokenAmount, stripAmountGroups } from '@/cip56/amount'
import { cn } from '@/utils/cn'

export interface AmountFieldProps {
  value: string
  onChange: (value: string) => void
  onMax: () => void
  balance: string
  tokenLabel: string
  error?: boolean
  testId?: string
}

const FIELD_CLASS =
  'flex items-center gap-2 rounded-md border bg-surface px-4 py-2.5 transition-colors ' +
  'focus-within:shadow-focus'

export const AmountField = ({
  value,
  onChange,
  onMax,
  balance,
  tokenLabel,
  error,
  testId,
}: AmountFieldProps): JSX.Element => (
  <div className="grid gap-1">
    <span className="text-[0.78rem] font-semibold text-muted-foreground">Amount</span>
    <div
      className={cn(
        FIELD_CLASS,
        error
          ? 'border-danger focus-within:border-danger'
          : 'border-border-strong focus-within:border-primary',
      )}
    >
      <input
        aria-label="Amount"
        data-testid={testId}
        aria-invalid={error ? true : undefined}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={formatAmountInput(value)}
        onChange={(event) => onChange(stripAmountGroups(event.target.value))}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-form-placeholder"
      />
      <button
        type="button"
        data-testid={testId === undefined ? undefined : `${testId}-max`}
        onClick={onMax}
        className="shrink-0 rounded-sm px-2 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:shadow-focus"
      >
        Max
      </button>
    </div>
    <span className="text-[0.72rem] text-muted-foreground">
      Balance: {formatTokenAmount(balance)} {tokenLabel}
    </span>
  </div>
)
