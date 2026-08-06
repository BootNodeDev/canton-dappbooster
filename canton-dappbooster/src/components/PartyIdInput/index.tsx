import { type FocusEvent, type InputHTMLAttributes, type ReactElement, useState } from 'react'
import { cx } from '../../utils/cx'
import { type PartyIdError, validatePartyId } from '../../utils/partyId'
import { anatomy } from './anatomy'

/** Props for {@link PartyIdInput} */
export interface PartyIdInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> {
  onChange: (value: string, error: PartyIdError | undefined) => void
  value: string
}

/**
 * A controlled text field for a Canton party id.
 *
 * It flags a malformed value with `aria-invalid` and hands the reason to `onChange`.
 *
 * @example
 * <PartyIdInput value={receiver} onChange={setReceiver} aria-describedby="receiver-error" />
 */
export const PartyIdInput = ({
  className,
  onBlur,
  onChange,
  value,
  ...rest
}: PartyIdInputProps): ReactElement => {
  const [touched, setTouched] = useState(false)
  const shownError = touched && value !== '' ? validatePartyId(value) : undefined

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    setTouched(true)
    onBlur?.(event)
  }

  return (
    <input
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      aria-invalid={shownError !== undefined || undefined}
      className={cx(anatomy.parts.root, className)}
      onBlur={handleBlur}
      onChange={(event) => {
        const next = event.target.value
        onChange(next, touched && next !== '' ? validatePartyId(next) : undefined)
      }}
      type="text"
      value={value}
    />
  )
}
