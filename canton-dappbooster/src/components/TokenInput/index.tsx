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
import { cx } from '../../utils/cx'
import { resolveInvalid } from '../../utils/invalid'
import {
  formatAmount,
  parseAmount,
  sanitizeAmountInput,
  settleAmount,
  type TokenAmountError,
  validateAmount,
} from '../../utils/tokenAmount'
import { anatomy } from './anatomy'
import { TokenSelectModal } from './TokenSelectModal'
import { useFormattedField } from './useFormattedField'

const ZERO = formatAmount('0.00')

/**
 * The token an amount is denominated in
 *
 * @example
 * const CC: TokenMeta = { symbol: 'CC', logo: <CantonCoinIcon /> }
 */
export interface TokenMeta {
  symbol: string
  logo?: ReactNode
}

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
  label?: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onChange: (value: string, error: TokenAmountError | undefined) => void
  onFocus?: FocusEventHandler<HTMLInputElement>
  onTokenSelect?: (token: TokenMeta) => void
  token: TokenMeta
  usdValue?: string
  value: string
}

/**
 * Props for {@link TokenInput}. One of `label`, `aria-label` or `aria-labelledby` is required: the
 * field is nothing but digits, so an unnamed one is unusable to a screen reader. `value` and
 * `balance` are exact decimals, grouped for display but never reported back grouped; `balance`
 * doubles as the ceiling `above-max` is measured against, and `usdValue` is rendered after the
 * component's own `~$`. A `balanceState` of either kind disables Max. `onTokenSelect` is what turns
 * the symbol into a button opening the token picker; the picker holds placeholders so far, so
 * nothing calls it yet.
 *
 * @example
 * <TokenInput label="Amount" token={{ symbol: 'CC' }} value={amount} balance={balance}
 *   usdValue="0.10" onChange={(next, error) => { setAmount(next); setError(error) }} />
 */
export type TokenInputProps = TokenInputOwnProps &
  ({ label: string } | { 'aria-label': string } | { 'aria-labelledby': string })

/**
 * Component to enter a Canton token amount
 *
 * @example
 * <TokenInput label="Amount" token={{ symbol: 'CC' }} value={amount} balance={balance}
 *   onChange={(next, error) => { setAmount(next); setError(error) }} />
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
            {token.logo}
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
            {token.logo}
            {/* The field's description targets the symbol, so it must not be the button itself. */}
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
          // Every Max on a page is named "Max"; the balance it fills is what tells them apart.
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
      <TokenSelectModal
        contentId={selectId}
        onClose={() => setSelectOpen(false)}
        open={selectOpen}
        returnFocusTo={triggerRef}
      />
    </div>
  )
}
