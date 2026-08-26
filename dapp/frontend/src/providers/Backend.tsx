import { useExecute, useLedger, useParty } from '@bootnodedev/canton-connect'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { type Deployment, loadBackendConfig } from '@/backend/config'
import { LiteBackend } from '@/backend/LiteBackend'
import type { VestingBackend } from '@/backend/VestingBackend'
import { errorText } from '@/utils/errorText'

// `backend` is undefined until a deployment is loaded and the wallet reports a party; both are
// needed to reach the ledger, so pages render a connect placeholder rather than empty data. The
// deployment resolves on its own, hence `configPending`: the shell holds the pages until it has,
// so a page with no backend can only mean no party.
export interface BackendState {
  backend: VestingBackend | undefined
  configError: string | undefined
  configPending: boolean
  sessionPending: boolean
}

// canton-connect cannot say whether a restore is still in flight: its status sits at `idle` both
// before `sdk.init()` resolves and forever after when there was no session to restore. So a page
// waits this long for a party to appear before concluding there is none, which is what stops the
// connect card flashing on every reload.
const SESSION_GRACE_MS = 1500

const BackendContext = createContext<BackendState | undefined>(undefined)

export const Backend = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [deployment, setDeployment] = useState<Deployment | undefined>(undefined)
  const [configError, setConfigError] = useState<string | undefined>(undefined)
  const { execute } = useExecute()
  const { ledgerApi } = useLedger()
  // A restored-but-locked session reports `connected` with no party, so the party is the gate: it
  // is what every read filters on and every submit acts as. Only its existence, though: the backend
  // takes the acting party per call, so depending on the object would rebuild the backend and
  // re-read the ACS whenever the wallet re-pushes the same account.
  const { party } = useParty()
  const hasParty = party !== undefined
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setCheckingSession(false), SESSION_GRACE_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    void loadBackendConfig().then(
      (config) => {
        if (!cancelled) {
          setDeployment(config)
        }
      },
      (err: unknown) => {
        if (!cancelled) {
          setConfigError(errorText(err))
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  // Its own memo, because the grace timer below flips a purely visual flag: sharing one would mint a
  // new backend identity mid-session and re-run every read that keys off it.
  const backend = useMemo(
    () =>
      deployment === undefined || !hasParty
        ? undefined
        : new LiteBackend(deployment, { execute, ledgerApi }),
    [deployment, execute, hasParty, ledgerApi],
  )

  const value = useMemo<BackendState>(
    () => ({
      backend,
      configPending: deployment === undefined && configError === undefined,
      configError,
      sessionPending: checkingSession && !hasParty,
    }),
    [backend, checkingSession, configError, deployment, hasParty],
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
