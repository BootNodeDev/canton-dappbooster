import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '@/backend/api'
import { useSession } from '@/providers/Session'
import { errorText } from '@/utils/errorText'

export interface BackendState {
  configError: string | undefined
  configPending: boolean
  ready: boolean
  retryConfig: () => void
  sessionPending: boolean
}

const RECHECK_MS = 5_000

type Status = { error?: string; ready: boolean }

const BackendContext = createContext<BackendState | undefined>(undefined)

export const Backend = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { pending: sessionPending, session } = useSession()
  const partyId = session?.partyId
  const [status, setStatus] = useState<Status | undefined>(undefined)
  // Only the newest check may write or schedule the next: a retry starts one while another is out.
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const check = useCallback((): void => {
    const mine = ++generation.current
    clearTimeout(timer.current)
    api<Status>('/status').then(
      (found) => {
        if (generation.current !== mine) return
        setStatus(found)
        if (!found.ready) timer.current = setTimeout(check, RECHECK_MS)
      },
      (err: unknown) => {
        if (generation.current !== mine) return
        setStatus({ ready: false, error: errorText(err) })
        timer.current = setTimeout(check, RECHECK_MS)
      },
    )
  }, [])

  // Asked only once someone signs in, so a signed-out page shows sign-in, not a deployment error
  useEffect(() => {
    if (partyId === undefined) {
      setStatus(undefined)
      return
    }
    check()
    return () => {
      generation.current += 1
      clearTimeout(timer.current)
    }
  }, [partyId, check])

  const retryConfig = useCallback(() => {
    setStatus(undefined)
    check()
  }, [check])

  const value = useMemo<BackendState>(
    () => ({
      configError: status?.ready === false ? (status.error ?? 'No deployment') : undefined,
      configPending: partyId !== undefined && status === undefined,
      ready: partyId !== undefined && status?.ready === true,
      retryConfig,
      sessionPending,
    }),
    [partyId, retryConfig, sessionPending, status],
  )

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>
}

export const useBackend = (): BackendState => {
  const state = useContext(BackendContext)
  if (state === undefined) {
    throw new Error('useBackend must be used within a Backend')
  }
  return state
}
