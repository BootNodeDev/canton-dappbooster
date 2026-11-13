import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Account } from '#server/domain/types'
import { ApiError, api, onSessionExpired } from '@/backend/api'

export interface SessionState {
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  pending: boolean
  session: Account | undefined
  signup: (username: string, password: string) => Promise<void>
}

const SessionContext = createContext<SessionState | undefined>(undefined)

export const Session = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [session, setSession] = useState<Account | undefined>(undefined)
  const [pending, setPending] = useState(true)

  useEffect(() => {
    let live = true
    api<Account>('/session')
      .then(
        (found) => {
          if (live) setSession(found)
        },
        // A 401 or any other failure leaves the sign-in form to try, so neither is an error here
        () => undefined,
      )
      .finally(() => {
        if (live) setPending(false)
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => onSessionExpired(() => setSession(undefined)), [])

  const login = useCallback(async (username: string, password: string) => {
    setSession(await api<Account>('/auth/login', { method: 'POST', body: { username, password } }))
  }, [])

  const signup = useCallback(async (username: string, password: string) => {
    setSession(await api<Account>('/auth/signup', { method: 'POST', body: { username, password } }))
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 0) throw error
    } finally {
      setSession(undefined)
    }
  }, [])

  const value = useMemo<SessionState>(
    () => ({ login, logout, pending, session, signup }),
    [login, logout, pending, session, signup],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionState => {
  const state = useContext(SessionContext)
  if (state === undefined) {
    throw new Error('useSession must be used within a Session')
  }
  return state
}
