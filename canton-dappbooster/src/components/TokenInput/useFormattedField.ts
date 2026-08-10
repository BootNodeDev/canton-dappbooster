import { type ChangeEvent, type RefObject, useLayoutEffect, useRef } from 'react'
import { caretBeforeDigits, countDigitsAfter, dropDigit } from './caret'

export interface FormattedFieldOptions {
  /** Groups the raw value for display. */
  format: (value: string) => string
  /** Fires with the sanitized value whenever an edit changes it. */
  onChange: (next: string) => void
  /** Reduces what the field now holds back to a raw value. */
  sanitize: (input: string) => string
  /** The controlled raw value, ungrouped. */
  value: string
}

/** Spread onto the `<input>`: the formatted value, the change handler, and the ref the caret needs. */
export interface FormattedField {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  ref: RefObject<HTMLInputElement | null>
  value: string
}

/**
 * Drives a text field whose display is regrouped on every keystroke, keeping the caret where the
 * user left it and undoing edits the sanitizer rejects.
 *
 * @example
 * const field = useFormattedField({ format, sanitize, value, onChange: setValue })
 * return <input onChange={field.onChange} ref={field.ref} value={field.value} />
 */
export const useFormattedField = ({
  format,
  onChange,
  sanitize,
  value,
}: FormattedFieldOptions): FormattedField => {
  const ref = useRef<HTMLInputElement>(null)
  const pending = useRef<{ digits: number; value: string } | null>(null)
  const display = format(value)

  // After commit, not in the handler: the index has to be counted against the regrouped
  // `field.value`, and without this the browser parks the caret at the end on every keystroke.
  useLayoutEffect(() => {
    const intent = pending.current
    pending.current = null
    const field = ref.current
    if (field === null || intent === null || intent.value !== value) return
    const caret = caretBeforeDigits(field.value, intent.digits)
    field.setSelectionRange(caret, caret)
  })

  return {
    onChange: (event) => {
      const typed = event.target.value
      const typedAt = event.target.selectionStart ?? typed.length
      const inputType = (event.nativeEvent as Partial<InputEvent>).inputType ?? ''
      const sanitized = sanitize(typed)
      const stalled = inputType.startsWith('delete') && sanitized === value
      const [raw, at] = stalled
        ? dropDigit(typed, typedAt, inputType.endsWith('Forward'))
        : [typed, typedAt]
      const digitsAfter = countDigitsAfter(raw, at)
      const next = stalled ? sanitize(raw) : sanitized

      if (next === value) {
        // A rejected keystroke leaves `value` untouched, so no re-render comes to run the effect:
        // restore the display and the caret by hand or the rejected character stays on screen.
        const caret = caretBeforeDigits(display, digitsAfter)
        event.target.value = display
        event.target.setSelectionRange(caret, caret)
      } else {
        pending.current = { digits: digitsAfter, value: next }
      }
      onChange(next)
    },
    ref,
    value: display,
  }
}
