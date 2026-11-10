import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/backend/api'
import { useSession } from '@/providers/Session'
import { errorText } from '@/utils/errorText'

export interface BackendState {
  configError: string | undefined
  configPending: boolean
  // Someone is signed in and the server found the vesting deployment: the API can be called.
  ready: boolean
  sessionPending: boolean
}

// While the server finds no vesting deployment, ask again at this pace: a `pnpm run bootstrap` run
// after the page loaded then shows up without a reload.
const RECHECK_MS = 5_000

type Status = { error?: string; ready: boolean }

const BackendContext = createContext<BackendState | undefined>(undefined)

export const Backend = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { pending: sessionPending, session } = useSession()
  const partyId = session?.partyId
  const [status, setStatus] = useState<Status | undefined>(undefined)

  // The deployment is the server's to find, but it is only asked about once someone is signed in:
  // until then the pages render the sign-in card rather than a deployment error.
  useEffect(() => {
    if (partyId === undefined) {
      setStatus(undefined)
      return
    }
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = (): void => {
      api<Status>('/status').then(
        (found) => {
          if (!live) return
          setStatus(found)
          if (!found.ready) timer = setTimeout(check, RECHECK_MS)
        },
        (err: unknown) => {
          if (!live) return
          setStatus({ ready: false, error: errorText(err) })
          timer = setTimeout(check, RECHECK_MS)
        },
      )
    }
    check()
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [partyId])

  const value = useMemo<BackendState>(
    () => ({
      configError: status?.ready === false ? (status.error ?? 'No deployment') : undefined,
      configPending: partyId !== undefined && status === undefined,
      ready: partyId !== undefined && status?.ready === true,
      sessionPending,
    }),
    [partyId, sessionPending, status],
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
