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

// An empty field is not invalid, it is empty; required-ness belongs to the form.
const errorOf = (value: string): PartyIdError | undefined =>
  value === '' ? undefined : validatePartyId(value)

/**
 * A controlled text field for a Canton party id.
 *
 * It flags a malformed value with `aria-invalid` and hands the reason to `onChange`. Pass
 * `aria-invalid` to flag the field for a reason the kit cannot know, such as a party the app
 * rejects.
 *
 * @example
 * <PartyIdInput value={receiver} onChange={setReceiver} aria-describedby="receiver-error" />
 */
export const PartyIdInput = ({
  'aria-invalid': ariaInvalid,
  className,
  onBlur,
  onChange,
  value,
  ...rest
}: PartyIdInputProps): ReactElement => {
  const [touched, setTouched] = useState(false)
  const shownError = touched ? errorOf(value) : undefined

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    setTouched(true)
    // A pasted id carries the whitespace around it; the id itself never does.
    const settled = value.trim()
    // Reported here too, or the first blur would paint an error the caller was never told about.
    if (!touched || settled !== value) onChange(settled, errorOf(settled))
    onBlur?.(event)
  }

  return (
    <input
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      {...{ [anatomy.states.invalid]: ariaInvalid ?? (shownError !== undefined || undefined) }}
      className={cx(anatomy.parts.root, className)}
      onBlur={handleBlur}
      onChange={(event) => {
        const next = event.target.value
        onChange(next, touched ? errorOf(next) : undefined)
      }}
      type="text"
      value={value}
    />
  )
}
