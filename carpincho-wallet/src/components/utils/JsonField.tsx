import { useEffect, useMemo } from 'react'
import { INPUT_CLASS } from '@/components/ui/TextInput'
import { cn } from '@/utils/cn'
import { formatJsonInput, parseJsonObject } from '@/utils/json'

interface JsonFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onValidityChange?: (valid: boolean) => void
  placeholder?: string
}

// Returns an error message when the text is not a JSON object, else undefined.
const validate = (value: string, label: string): string | undefined => {
  try {
    parseJsonObject(value, label)
    return undefined
  } catch (err) {
    if (!(err instanceof Error)) return 'Invalid JSON'
    const prefix = `${label}: `
    const message = err.message.startsWith(prefix) ? err.message.slice(prefix.length) : err.message
    return message
  }
}

// JSON object textarea with live validation and format-on-blur for ledger command payloads.
export const JsonField = ({
  id,
  label,
  value,
  onChange,
  onValidityChange,
  placeholder,
}: JsonFieldProps): JSX.Element => {
  const errorMessage = useMemo(() => validate(value, label), [value, label])

  useEffect(() => {
    onValidityChange?.(errorMessage === undefined)
  }, [errorMessage, onValidityChange])

  const onBlur = (): void => {
    try {
      onChange(formatJsonInput(value, label))
    } catch {
      // Leave partially typed input untouched when it cannot be parsed yet.
    }
  }

  return (
    <label
      htmlFor={id}
      className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {label}
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        aria-invalid={errorMessage === undefined ? undefined : true}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        className={cn(
          INPUT_CLASS,
          'min-h-44 resize-y font-mono text-[0.85rem] normal-case tracking-normal',
          errorMessage !== undefined &&
            'border-danger focus:border-danger shadow-focus-danger focus:shadow-focus-danger',
        )}
      />
      {errorMessage === undefined ? null : (
        <span className="text-[0.78rem] font-medium normal-case tracking-normal text-danger">
          Invalid JSON: {errorMessage}
        </span>
      )}
    </label>
  )
}
