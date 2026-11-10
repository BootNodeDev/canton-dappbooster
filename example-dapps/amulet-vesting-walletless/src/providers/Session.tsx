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

// Who is signed in: the account name and the party the server provisioned for it at signup. The
// party is the one every read and write acts as; there is no wallet to pick another.
export interface Session {
  partyId: PartyId
  username: string
}

export interface SessionState {
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  // True until the cookie the browser may already hold has been asked about.
  pending: boolean
  session: Session | undefined
  signup: (username: string, password: string) => Promise<void>
}

const SessionContext = createContext<SessionState | undefined>(undefined)

export const SessionProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [session, setSession] = useState<Session | undefined>(undefined)
  const [pending, setPending] = useState(true)

  // A 401 is simply nobody signed in, and any other failure still leaves the sign-in form to try, so
  // both end the pending state the same way.
  useEffect(() => {
    let live = true
    api<Session>('/session')
      .then(
        (found) => {
          if (live) setSession(found)
        },
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
      // The cookie is gone either way once the server forgets it; an unreachable server is the one
      // case worth saying so, and the local session still ends.
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
