import {
  type ChangeEvent,
  type FocusEvent,
  type FocusEventHandler,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
} from 'react'
import { cx } from '../../utils/cx'
import {
  formatAmount,
  parseAmount,
  sanitizeAmountInput,
  settleAmount,
  type TokenAmountError,
  validateAmount,
} from '../../utils/tokenAmount'
import { anatomy } from './anatomy'
import { caretBeforeDigits, countDigitsAfter } from './caret'

/** The token an amount is denominated in. */
export interface TokenMeta {
  symbol: string
  name?: string
  logo?: ReactNode
}

/**
 * Props for {@link TokenInput} */
export interface TokenInputProps
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
  // Declared for the field rather than inherited for the root: they fire from the input.
  onBlur?: FocusEventHandler<HTMLInputElement>
  onChange: (value: string, error: TokenAmountError | undefined) => void
  onFocus?: FocusEventHandler<HTMLInputElement>
  token: TokenMeta
  usdValue?: string
  value: string
}

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
  usdValue,
  token,
  value,
  ...rest
}: TokenInputProps): ReactElement => {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const balanceId = `${fieldId}-balance`
  const tokenId = `${fieldId}-token`
  const fieldRef = useRef<HTMLInputElement>(null)
  const pendingDigits = useRef<number | null>(null)
  const bounds = { max: balance }
  const error = validateAmount(value, bounds)
  const display = formatAmount(value)
  const invalid = ariaInvalid ?? (error !== undefined || undefined)
  const rootInvalid = invalid !== undefined && invalid !== false && invalid !== 'false'
  const scaledBalance = parseAmount(balance ?? '')

  const balanceText =
    balanceState === 'error' ? 'Balance: N/A' : `Balance: ${formatAmount(balance ?? '0.00')}`

  // Applied after the regrouped display is committed, or the browser would leave the caret at the
  // end of the value on every keystroke. Resolved here rather than in the handler because the
  // committed `field.value` is the regrouped string the index has to be counted against.
  useLayoutEffect(() => {
    const field = fieldRef.current
    if (field !== null && pendingDigits.current !== null) {
      const caret = caretBeforeDigits(field.value, pendingDigits.current)
      field.setSelectionRange(caret, caret)
      pendingDigits.current = null
    }
  })

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value
    const digitsAfter = countDigitsAfter(raw, event.target.selectionStart ?? raw.length)
    const next = sanitizeAmountInput(raw)

    if (next === value) {
      // A rejected keystroke leaves `value` untouched, so React sees no change and would not rewrite
      // the DOM: the rejected character would stay on screen. Put the display back by hand, and
      // place the caret here since no re-render is coming to run the layout effect for us.
      const caret = caretBeforeDigits(display, digitsAfter)
      event.target.value = display
      event.target.setSelectionRange(caret, caret)
    } else {
      pendingDigits.current = digitsAfter
    }
    onChange(next, validateAmount(next, bounds))
  }

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
        [anatomy.states.rootInvalid]: rootInvalid || undefined,
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
          aria-describedby={cx(describedBy, tokenId) || undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          autoComplete="off"
          className={anatomy.parts.field}
          disabled={disabled}
          id={fieldId}
          inputMode="decimal"
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={onFocus}
          placeholder={formatAmount('0.00')}
          ref={fieldRef}
          spellCheck={false}
          type="text"
          value={display}
          {...{ [anatomy.states.invalid]: invalid }}
        />
        <span className={anatomy.parts.token} id={tokenId}>
          {token.logo}
          {token.symbol}
        </span>
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
          {...{ [anatomy.states.balance]: balanceState ?? 'ready' }}
        >
          {balanceText}
        </span>
        <button
          // Every Max on a page is named "Max"; the balance it fills is what tells them apart.
          aria-describedby={balanceId}
          className={anatomy.parts.max}
          disabled={
            disabled ||
            balanceState !== undefined ||
            scaledBalance === undefined ||
            scaledBalance === 0n
          }
          onClick={() => {
            if (balance !== undefined) onChange(balance, validateAmount(balance, bounds))
          }}
          type="button"
        >
          Max
        </button>
      </div>
    </div>
  )
}
