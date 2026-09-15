import { useExecute, useLedger, useParty } from '@bootnodedev/canton-connect'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { type Deployment, loadBackendConfig } from '@/backend/config'
import { LedgerBackend } from '@/backend/LedgerBackend'
import type { VestingBackend } from '@/backend/VestingBackend'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { errorText } from '@/utils/errorText'
import type { NetworkStatus } from '@/utils/network'

export interface BackendState {
  backend: VestingBackend | undefined
  configError: string | undefined
  configPending: boolean
  networkStatus: NetworkStatus | undefined
  sessionPending: boolean
}

const SESSION_GRACE_MS = 1500

const BackendContext = createContext<BackendState | undefined>(undefined)

export const Backend = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [deployment, setDeployment] = useState<Deployment | undefined>(undefined)
  const [configError, setConfigError] = useState<string | undefined>(undefined)
  const { execute } = useExecute()
  const { ledgerApi } = useLedger()

  const { party } = useParty()
  const hasParty = party !== undefined
  const partyId = party?.partyId
  const [checkingSession, setCheckingSession] = useState(true)
  const networkStatus = useNetworkStatus(ledgerApi, partyId, party?.networkId)

  useEffect(() => {
    const timer = setTimeout(() => setCheckingSession(false), SESSION_GRACE_MS)
    return () => clearTimeout(timer)
  }, [])

  // The deployment is read off the ledger, so it cannot resolve before there is a session to read
  // through. Until then it is not pending but absent, which is what leaves the pages free to render
  // their own connect card.
  useEffect(() => {
    if (!hasParty) {
      return
    }
    let cancelled = false

    void loadBackendConfig(ledgerApi).then(
      (config) => {
        if (!cancelled) {
          setDeployment(config)
          setConfigError(undefined)
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
  }, [hasParty, ledgerApi])

  const backend = useMemo(
    () =>
      deployment === undefined || !hasParty
        ? undefined
        : new LedgerBackend(deployment, { execute, ledgerApi }),
    [deployment, execute, hasParty, ledgerApi],
  )

  const value = useMemo<BackendState>(
    () => ({
      backend,
      configPending: hasParty && deployment === undefined && configError === undefined,
      configError,
      networkStatus,
      sessionPending: checkingSession && !hasParty,
    }),
    [backend, checkingSession, configError, deployment, hasParty, networkStatus],
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
