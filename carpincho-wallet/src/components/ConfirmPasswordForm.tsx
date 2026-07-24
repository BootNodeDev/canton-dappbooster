import { type FormEvent, type ReactNode, useState } from 'react'
import { PrimaryButton } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useVault } from '@/vault/useVault'

interface ConfirmPasswordFormProps {
  label: string
  submitLabel: string
  // Called with the entered password once it matches the unlocked vault password.
  onVerified: (password: string) => void
  // Seeds an error on mount (e.g. a failure from the action this gate precedes).
  initialError?: string | null
  // Content rendered above the password field (account summary, description).
  children?: ReactNode
  passwordTestId?: string
  submitTestId?: string
}

// Re-checks the unlocked vault password before a sensitive action (change password,
// reveal private key). Centralizes the input, a11y wiring, and incorrect-password handling.
export const ConfirmPasswordForm = ({
  label,
  submitLabel,
  onVerified,
  initialError = null,
  children,
  passwordTestId,
  submitTestId,
}: ConfirmPasswordFormProps): JSX.Element => {
  const v = useVault()
  const [current, setCurrent] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const hasError = error !== null

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!v.verifyPassword(current)) {
      setError('Incorrect password.')
      return
    }
    setError(null)
    setCurrent('')
    onVerified(current)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      {children}
      <PasswordInput
        aria-label={label}
        data-testid={passwordTestId}
        aria-errormessage={hasError ? 'confirm-password-error' : undefined}
        placeholder="Current password"
        autoComplete="current-password"
        error={hasError}
        value={current}
        onChange={(event) => {
          setCurrent(event.target.value)
          setError(null)
        }}
      />
      {hasError && (
        <p
          id="confirm-password-error"
          className="text-[0.85rem] text-danger"
        >
          {error}
        </p>
      )}
      <PrimaryButton
        type="submit"
        data-testid={submitTestId}
      >
        {submitLabel}
      </PrimaryButton>
    </form>
  )
}
