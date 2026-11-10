import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ApiError, api, onSessionExpired } from '@/backend/api'
import type { PartyId } from '@/store/types'

export interface Session {
  partyId: PartyId
  username: string
}

export interface SessionState {
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  pending: boolean
  session: Session | undefined
  signup: (username: string, password: string) => Promise<void>
}

const SessionContext = createContext<SessionState | undefined>(undefined)

export const SessionProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [session, setSession] = useState<Session | undefined>(undefined)
  const [pending, setPending] = useState(true)

  useEffect(() => {
    let live = true
    api<Session>('/session')
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
    setSession(await api<Session>('/auth/login', { method: 'POST', body: { username, password } }))
  }, [])

  const signup = useCallback(async (username: string, password: string) => {
    setSession(await api<Session>('/auth/signup', { method: 'POST', body: { username, password } }))
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
    throw new Error('useSession must be used within a SessionProvider')
  }
  return state
}
