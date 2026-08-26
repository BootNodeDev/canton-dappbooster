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
}

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

  const value = useMemo<BackendState>(
    () => ({
      backend:
        deployment === undefined || !hasParty
          ? undefined
          : new LiteBackend(deployment, { execute, ledgerApi }),
      configPending: deployment === undefined && configError === undefined,
      configError,
    }),
    [configError, deployment, execute, hasParty, ledgerApi],
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
