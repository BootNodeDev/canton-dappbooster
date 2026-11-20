import { useEffect, useId, useState } from 'react'
import type { ServerStatus } from '#server/domain/types'
import { api } from '@/backend/api'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { inputClass, labelClass } from '@/components/CreateGrant/fields'
import { FieldError } from '@/components/FieldError'
import { useSession } from '@/providers/Session'
import { cn } from '@/utils/cn'
import { errorText } from '@/utils/errorText'

type Mode = 'login' | 'signup'

const MIN_PASSWORD = 8

const tabClass = (active: boolean): string =>
  cn(
    'h-9 flex-1 rounded-[calc(var(--radius-control)-3px)] px-3 text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
    active
      ? 'bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.12)]'
      : 'text-fg-muted hover:text-fg',
  )

export const AuthCard = (): React.JSX.Element => {
  const { login, signup } = useSession()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [ttlHours, setTtlHours] = useState<number>()
  const id = useId()

  // Asked on the first switch to signup: a sign-in has no use for it.
  useEffect(() => {
    if (mode !== 'signup' || ttlHours !== undefined) return
    api<ServerStatus>('/status').then(
      (status) => setTtlHours(status.accountTtlHours ?? 0),
      () => undefined,
    )
  }, [mode, ttlHours])

  const signingUp = mode === 'signup'
  const valid =
    username.trim() !== '' && (signingUp ? password.length >= MIN_PASSWORD : password !== '')

  const switchTo = (next: Mode): void => {
    setMode(next)
    setError(undefined)
  }

  const submit = async (): Promise<void> => {
    if (!valid || submitting) return
    setSubmitting(true)
    setError(undefined)
    try {
      await (signingUp ? signup : login)(username.trim().toLowerCase(), password)
    } catch (err) {
      setError(errorText(err))
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full p-6 text-left sm:p-7">
      <div
        role="tablist"
        aria-label="Account"
        className="flex gap-0.5 rounded-control border border-border bg-surface-2 p-[3px]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!signingUp}
          className={tabClass(!signingUp)}
          onClick={() => switchTo('login')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={signingUp}
          className={tabClass(signingUp)}
          onClick={() => switchTo('signup')}
        >
          Create account
        </button>
      </div>

      <form
        className="mt-5 flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div>
          <label htmlFor={`${id}-username`} className={labelClass}>
            Username
          </label>
          <input
            id={`${id}-username`}
            autoCapitalize="none"
            autoComplete="username"
            className={inputClass}
            onChange={(event) => setUsername(event.target.value)}
            spellCheck={false}
            value={username}
          />
        </div>
        <div>
          <label htmlFor={`${id}-password`} className={labelClass}>
            Password
          </label>
          <input
            id={`${id}-password`}
            aria-describedby={signingUp ? `${id}-password-hint` : undefined}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            className={inputClass}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          {signingUp && (
            <p id={`${id}-password-hint`} className="mt-1 text-xs text-fg-muted">
              At least {MIN_PASSWORD} characters.
            </p>
          )}
        </div>
        {error !== undefined && <FieldError id={`${id}-error`} message={error} />}
        <Button type="submit" size="lg" disabled={!valid} pending={submitting}>
          {signingUp ? 'Create account' : 'Sign in'}
        </Button>
        {signingUp && (
          <p className="text-xs text-fg-muted">
            {ttlHours !== undefined && ttlHours > 0
              ? `Accounts are deleted ${ttlHours} hour${ttlHours === 1 ? '' : 's'} after sign-up.`
              : 'Creating an account also creates your Canton party. No wallet needed.'}
          </p>
        )}
      </form>
    </Card>
  )
}
