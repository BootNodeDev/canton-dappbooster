import { useEffect, useId, useRef } from 'react'
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  isConfirmMismatch,
  isNewPasswordPairValid,
  usePasswordStrengthReady,
} from '@/vault/passwordStrength'

const PASSWORD_RECOMMENDATIONS = (
  <div className="flex flex-col gap-2">
    <p>
      Aim for <strong>12+ characters</strong>. Length is the biggest factor.
    </p>
    <p>
      A string of unrelated words (e.g.{' '}
      <span className="font-mono">correctly-growing-a-horse-battery</span>) is easier to remember
      and <strong>harder to crack</strong> than short complex passwords.
    </p>
    <p>Avoid names, dates, dictionary words, and common substitutions (pa$$word, p@ssw0rd).</p>
    <p>
      The vault is encrypted locally: a stolen vault file can be attacked offline without rate
      limits. Password strength is important.
    </p>
  </div>
)

type Props = {
  password: string
  confirm: string
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
  onValidityChange: (valid: boolean) => void
  passwordLabel?: string
  confirmLabel?: string
  labelMode?: 'visible' | 'aria'
  passwordTestId?: string
  confirmTestId?: string
}

export const NewPasswordFields = ({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  onValidityChange,
  passwordLabel = 'New password',
  confirmLabel = 'Confirm new password',
  labelMode = 'aria',
  passwordTestId,
  confirmTestId,
}: Props): JSX.Element => {
  usePasswordStrengthReady()
  const passwordId = useId()
  const confirmId = useId()
  const strengthId = useId()
  const valid = isNewPasswordPairValid(password, confirm)
  const visible = labelMode === 'visible'
  const lastReported = useRef<boolean | null>(null)

  useEffect(() => {
    if (lastReported.current === valid) return
    lastReported.current = valid
    onValidityChange(valid)
  }, [valid, onValidityChange])

  return (
    <>
      <div className="flex flex-col gap-1">
        <div>
          {visible && (
            <div className="mb-[0.55rem] flex items-center gap-1.5">
              <label
                className="mb-0"
                htmlFor={passwordId}
              >
                {passwordLabel}
              </label>
              <Tooltip
                label="Password recommendations"
                content={PASSWORD_RECOMMENDATIONS}
              />
            </div>
          )}
          <PasswordInput
            aria-describedby={strengthId}
            aria-label={visible ? undefined : passwordLabel}
            autoComplete="new-password"
            id={visible ? passwordId : undefined}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={visible ? undefined : passwordLabel}
            value={password}
            {...(passwordTestId === undefined ? {} : { 'data-testid': passwordTestId })}
          />
        </div>
        <PasswordStrengthIndicator
          id={strengthId}
          password={password}
        />
      </div>
      <div>
        {visible && <label htmlFor={confirmId}>{confirmLabel}</label>}
        <PasswordInput
          aria-label={visible ? undefined : confirmLabel}
          autoComplete="new-password"
          error={isConfirmMismatch(password, confirm)}
          id={visible ? confirmId : undefined}
          onChange={(e) => onConfirmChange(e.target.value)}
          placeholder={visible ? undefined : confirmLabel}
          value={confirm}
          {...(confirmTestId === undefined ? {} : { 'data-testid': confirmTestId })}
        />
      </div>
    </>
  )
}
