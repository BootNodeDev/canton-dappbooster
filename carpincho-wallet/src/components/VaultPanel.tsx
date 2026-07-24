import { type FormEvent, useId, useState } from 'react'
import { NewPasswordFields } from '@/components/NewPasswordFields'
import { PrimaryButton } from '@/components/ui/Button'
import { OptionList } from '@/components/ui/OptionList'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { toast } from '@/components/ui/toast'
import type { AutoLockOption } from '@/vault/storage'
import { useVault } from '@/vault/useVault'

const AUTO_LOCK_LABELS: Array<{ value: AutoLockOption; label: string }> = [
  { value: 'never', label: 'Never' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '1h', label: '1 hour' },
]

interface PasswordState {
  current: string
  next: string
  confirm: string
  valid: boolean
  error: string | null
}

const initialState = (): PasswordState => ({
  current: '',
  next: '',
  confirm: '',
  valid: false,
  error: null,
})

export const PasswordForm = (): JSX.Element => {
  const v = useVault()
  const [state, setState] = useState<PasswordState>(initialState)
  const [busy, setBusy] = useState(false)
  const currentId = useId()

  const canSubmit = state.current.trim() !== '' && state.valid

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      await v.changePassword(state.current, state.next)
      setState(initialState())
      toast.success('Password updated.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not change password.'
      setState((s) => ({ ...s, error: msg }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3"
    >
      <div>
        <label htmlFor={currentId}>Current password</label>
        <PasswordInput
          id={currentId}
          aria-errormessage={state.error !== null ? 'change-password-error' : undefined}
          autoComplete="current-password"
          error={state.error !== null}
          value={state.current}
          onChange={(e) => setState((s) => ({ ...s, current: e.target.value, error: null }))}
        />
      </div>
      <hr className="border-border" />
      <NewPasswordFields
        confirm={state.confirm}
        labelMode="visible"
        onConfirmChange={(value) => setState((s) => ({ ...s, confirm: value }))}
        onPasswordChange={(value) => setState((s) => ({ ...s, next: value }))}
        onValidityChange={(valid) => setState((s) => ({ ...s, valid }))}
        password={state.next}
      />
      {state.error !== null && (
        <p
          id="change-password-error"
          className="text-[0.85rem] text-danger"
        >
          {state.error}
        </p>
      )}
      <PrimaryButton
        disabled={!canSubmit || busy}
        type="submit"
      >
        {busy ? 'Changing…' : 'Change password'}
      </PrimaryButton>
    </form>
  )
}

export const AutoLockList = (): JSX.Element => {
  const v = useVault()
  return (
    <OptionList
      options={AUTO_LOCK_LABELS}
      value={v.autoLockOption}
      onSelect={v.setAutoLockOption}
    />
  )
}
