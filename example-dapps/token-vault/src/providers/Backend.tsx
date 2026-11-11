import { useAccount, useExecute, useLedger } from '@bootnodedev/canton-connect'
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
import { type Deployment, loadDeployment } from '@/backend/deployment'
import { LedgerBackend } from '@/backend/LedgerBackend'
import type { VaultBackend } from '@/backend/VaultBackend'
import { errorText } from '@/utils/errorText'

export interface BackendState {
  backend: VaultBackend | undefined
  deployment: Deployment | undefined
  deploymentError: string | undefined
  deploymentPending: boolean
  retryDeployment: () => void
  sessionPending: boolean
}

// canton-connect cannot say whether a restore is in flight, so a page waits this long for a party.
const SESSION_GRACE_MS = 1500

const BackendContext = createContext<BackendState | undefined>(undefined)

export const Backend = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [deployment, setDeployment] = useState<Deployment | undefined>(undefined)
  const [deploymentError, setDeploymentError] = useState<string | undefined>(undefined)
  // Only the newest load may write: a retry can start while an earlier one is still in flight.
  const generation = useRef(0)
  const { execute } = useExecute()
  const { ledgerApi } = useLedger()
  const { account } = useAccount()
  const hasParty = account !== undefined
  const partyId = account?.partyId
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setCheckingSession(false), SESSION_GRACE_MS)
    return () => clearTimeout(timer)
  }, [])

  const load = useCallback(() => {
    const attempt = ++generation.current
    setDeploymentError(undefined)

    void loadDeployment(ledgerApi).then(
      (loaded) => {
        if (generation.current === attempt) {
          setDeployment(loaded)
        }
      },
      (err: unknown) => {
        if (generation.current === attempt) {
          setDeploymentError(errorText(err))
        }
      },
    )
  }, [ledgerApi])

  // Keyed on the id, since the deployment is read as that party: a switched account reads it again.
  useEffect(() => {
    if (partyId === undefined) {
      generation.current += 1
      setDeployment(undefined)
      setDeploymentError(undefined)
      return
    }
    load()

    return () => {
      generation.current += 1
    }
  }, [partyId, load])

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
      deployment,
      deploymentError,
      deploymentPending: hasParty && deployment === undefined && deploymentError === undefined,
      retryDeployment: load,
      sessionPending: checkingSession && !hasParty,
    }),
    [backend, checkingSession, deployment, deploymentError, hasParty, load],
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
