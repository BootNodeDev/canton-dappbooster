import {
  type FocusEvent,
  type FocusEventHandler,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react'
import { anatomy } from '#src/components/TokenInput/anatomy'
import { TokenSelectDialog } from '#src/components/TokenInput/TokenSelectDialog'
import { useFormattedField } from '#src/components/TokenInput/useFormattedField'
import { TokenLogo } from '#src/components/TokenLogo'
import type { Token } from '#src/providers/TokenListProvider/context'
import { cx } from '#src/utils/cx'
import { resolveInvalid } from '#src/utils/invalid'
import {
  formatAmount,
  parseAmount,
  sanitizeAmountInput,
  settleAmount,
  type TokenAmountError,
  validateAmount,
} from '#src/utils/tokenAmount'

const ZERO = formatAmount('0.00')

/**
 * The token an amount is denominated in: what the field renders, and no more. A `Token` off the
 * list provider satisfies it, so a pick goes straight back into the field. `onTokenSelect` hands
 * back the whole `Token`, identity included, because that is what the picker resolved.
 *
 * @example
 * const CC: TokenMeta = { symbol: 'CC', logo: <CantonCoinIcon /> }
 *
 * @category Components
 */
export interface TokenMeta {
  symbol: string
  logo?: ReactNode
}

// Inlined into TokenInputProps rather than exported: the intersection is the public type, and
// typedoc otherwise reports a public type referencing something the reference cannot show.
/** @inline */
interface TokenInputOwnProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    | 'aria-errormessage'
    | 'aria-required'
    | 'autoCapitalize'
    | 'autoCorrect'
    | 'autoFocus'
    | 'children'
    | 'enterKeyHint'
    | 'inputMode'
    | 'onBlur'
    | 'onChange'
    | 'onFocus'
    | 'spellCheck'
    | 'tabIndex'
  > {
  balance?: string
  balanceState?: 'loading' | 'error'
  disabled?: boolean
  favoriteIds?: readonly string[]
  label?: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onChange: (value: string, error: TokenAmountError | undefined) => void
  onFocus?: FocusEventHandler<HTMLInputElement>
  onTokenSelect?: (token: Token) => void
  token: TokenMeta
  usdValue?: string
  value: string
}

/**
 * Props for {@link TokenInput}.
 *
 * @example
 * <TokenInput label="Amount" token={{ symbol: 'CC' }} value={amount} balance={balance}
 *   usdValue="0.10" onChange={(next, error) => { setAmount(next); setError(error) }} />
 *
 * @category Components
 */
export type TokenInputProps = TokenInputOwnProps &
  ({ label: string } | { 'aria-label': string } | { 'aria-labelledby': string })

/**
 * A controlled field for a Canton token amount. The value stays a decimal string end to end, since
 * a `number` cannot carry `Numeric 10` without losing digits; grouping separators are added for
 * reading and stripped on the way back. Max fills from `balance`, which is also the ceiling
 * `onChange` validates against, so the button never offers more than the field will accept.
 * Passing `onTokenSelect` turns the symbol into a picker over the `TokenListProvider` list.
 *
 * @example
 * <TokenInput label="Amount" token={{ symbol: 'CC' }} value={amount} balance={balance}
 *   onChange={(next, error) => { setAmount(next); setError(error) }} />
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/TokenInput/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @category Components
 */
export const TokenInput = ({
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  balance,
  balanceState,
  className,
  disabled,
  favoriteIds,
  id,
  label,
  onBlur,
  onChange,
  onFocus,
  onTokenSelect,
  usdValue,
  token,
  value,
  ...rest
}: TokenInputProps): ReactElement => {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const balanceId = `${fieldId}-balance`
  const tokenId = `${fieldId}-token`
  const selectId = `${fieldId}-token-select`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const bounds = { max: balance }
  const error = validateAmount(value, bounds)
  const [invalid, flagged] = resolveInvalid(ariaInvalid, error !== undefined)
  const [selectOpen, setSelectOpen] = useState(false)
  const noBalance = !parseAmount(balance ?? '')

  const balanceText =
    balanceState === 'error'
      ? 'Balance: N/A'
      : `Balance: ${balance === undefined ? ZERO : formatAmount(balance)}`

  const field = useFormattedField({
    format: formatAmount,
    onChange: (next) => onChange(next, validateAmount(next, bounds)),
    sanitize: sanitizeAmountInput,
    value,
  })

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    const settled = settleAmount(value)
    if (settled !== value) onChange(settled, validateAmount(settled, bounds))
    onBlur?.(event)
  }

  return (
    <div
      className={cx(anatomy.parts.root, className)}
      {...rest}
      {...{
        [anatomy.states.invalid]: flagged || undefined,
        [anatomy.states.disabled]: disabled || undefined,
      }}
    >
      {label !== undefined && (
        <label className={anatomy.parts.label} htmlFor={fieldId}>
          {label}
        </label>
      )}
      <div className={anatomy.parts.row}>
        <input
          aria-describedby={cx(describedBy, tokenId, balanceId) || undefined}
          aria-invalid={invalid}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          autoComplete="off"
          className={anatomy.parts.field}
          disabled={disabled}
          id={fieldId}
          inputMode="decimal"
          onBlur={handleBlur}
          onChange={field.onChange}
          onFocus={onFocus}
          placeholder={ZERO}
          ref={field.ref}
          spellCheck={false}
          type="text"
          value={field.value}
        />
        {onTokenSelect === undefined ? (
          <span className={anatomy.parts.token} id={tokenId}>
            <TokenLogo logo={token.logo} symbol={token.symbol} />
            {token.symbol}
          </span>
        ) : (
          <button
            aria-controls={selectOpen ? selectId : undefined}
            aria-expanded={selectOpen}
            aria-haspopup="dialog"
            className={anatomy.parts.token}
            disabled={disabled}
            onClick={() => setSelectOpen(true)}
            ref={triggerRef}
            type="button"
            {...{ [anatomy.states.interactive]: true }}
          >
            <TokenLogo logo={token.logo} symbol={token.symbol} />
            <span id={tokenId}>{token.symbol}</span>
          </button>
        )}
      </div>
      <div className={anatomy.parts.meta}>
        ~$
        {usdValue !== undefined ? (
          <span className={anatomy.parts.usdValue}>{usdValue}</span>
        ) : (
          '0.00'
        )}
        <span
          aria-busy={balanceState === 'loading' || undefined}
          className={anatomy.parts.balance}
          id={balanceId}
          role="status"
          {...{ [anatomy.states.balance]: balanceState ?? 'ready' }}
        >
          {balanceText}
        </span>
        <button
          aria-describedby={balanceId}
          className={anatomy.parts.max}
          disabled={disabled || balanceState !== undefined || noBalance}
          onClick={() => {
            if (balance !== undefined) onChange(balance, validateAmount(balance, bounds))
          }}
          type="button"
        >
          Max
        </button>
      </div>
      {onTokenSelect !== undefined && (
        <TokenSelectDialog
          contentId={selectId}
          favoriteIds={favoriteIds}
          onClose={() => setSelectOpen(false)}
          onSelect={onTokenSelect}
          open={selectOpen}
          returnFocusTo={triggerRef}
        />
      )}
    </div>
  )
}
