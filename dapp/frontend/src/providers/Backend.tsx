import { useExecute, useLedger, useParty } from '@bootnodedev/canton-connect'
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
import { type Deployment, loadBackendConfig } from '@/backend/config'
import { LedgerBackend } from '@/backend/LedgerBackend'
import type { RegistryInstrument } from '@/backend/registry'
import type { VestingBackend } from '@/backend/VestingBackend'
import { useWrongNetwork } from '@/hooks/useWrongNetwork'
import { errorText } from '@/utils/errorText'

// `backend` is undefined until a deployment is loaded and the wallet reports a party; both are
// needed to reach the ledger, so pages render a connect placeholder rather than empty data. The
// deployment is read through that same party, hence `configPending`: it only ever stands for a
// connected session still resolving, so a page with no backend can only mean no party.
export interface BackendState {
  backend: VestingBackend | undefined
  configError: string | undefined
  configPending: boolean
  // The one instrument this deployment vests, which is what tells the token catalogue which of its
  // rows the app can act on. Undefined until the deployment is read.
  instrument: RegistryInstrument | undefined
  retryConfig: () => void
  sessionPending: boolean
  wrongNetwork: boolean
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
  // Only the newest load may write: a retry can be asked for while an earlier one is still in
  // flight, and the effect's own teardown has no way to reach a call the callback started.
  const generation = useRef(0)
  const { execute } = useExecute()
  const { ledgerApi } = useLedger()
  // A restored-but-locked session reports `connected` with no party, so the party is the gate: it
  // is what every read filters on and every submit acts as. Only its existence, though: the backend
  // takes the acting party per call, so depending on the object would rebuild the backend and
  // re-read the ACS whenever the wallet re-pushes the same account.
  const { party } = useParty()
  const hasParty = party !== undefined
  const partyId = party?.partyId
  const [checkingSession, setCheckingSession] = useState(true)
  const wrongNetwork = useWrongNetwork(ledgerApi, partyId)

  useEffect(() => {
    const timer = setTimeout(() => setCheckingSession(false), SESSION_GRACE_MS)
    return () => clearTimeout(timer)
  }, [])

  // A callback rather than effect-body code because the error card offers it again: half the
  // deployment comes from the registry, a separately restarted process, so a failure here outlives
  // neither the party nor the ledger transport and nothing else would ever retry it. The error is
  // cleared on entry, so a retry that succeeds cannot leave the shell reporting the failure it
  // replaced.
  const loadConfig = useCallback(() => {
    const attempt = ++generation.current
    setConfigError(undefined)

    void loadBackendConfig(ledgerApi).then(
      (config) => {
        if (generation.current === attempt) {
          setDeployment(config)
        }
      },
      (err: unknown) => {
        if (generation.current === attempt) {
          setConfigError(errorText(err))
        }
      },
    )
  }, [ledgerApi])

  // The registry half of the deployment needs no session, but it shares this one call with the
  // ledger half, which does, so until there is a party the deployment is not pending but absent,
  // which leaves the pages free to render their own connect card. Keyed on the id rather than on
  // merely having one, because the deployment is read as that party: a wallet switching accounts
  // with no disconnect between would otherwise keep the previous account's factory, and the id
  // being a string is what still makes re-pushing the same account a no-op.
  useEffect(() => {
    if (partyId === undefined) {
      // Cleared, not merely left alone: a reconnect against another participant would otherwise
      // build a backend from the previous deployment for a render, long enough for a write to carry
      // the old factory, and an error card left standing would hold the shell where a session that
      // no longer exists cannot retry it.
      generation.current += 1
      setDeployment(undefined)
      setConfigError(undefined)
      return
    }
    loadConfig()

    return () => {
      generation.current += 1
    }
  }, [partyId, loadConfig])

  // Its own memo, because the grace timer below flips a purely visual flag: sharing one would mint a
  // new backend identity mid-session and re-run every read that keys off it.
  const backend = useMemo(
    () =>
      deployment === undefined || !hasParty
        ? undefined
        : new LedgerBackend(deployment, { execute, ledgerApi }),
    [deployment, execute, hasParty, ledgerApi],
  )

  const instrument = useMemo<RegistryInstrument | undefined>(
    () =>
      deployment === undefined
        ? undefined
        : { admin: deployment.admin, instrumentId: deployment.instrumentId },
    [deployment],
  )

  const value = useMemo<BackendState>(
    () => ({
      backend,
      configPending: hasParty && deployment === undefined && configError === undefined,
      configError,
      instrument,
      retryConfig: loadConfig,
      sessionPending: checkingSession && !hasParty,
      wrongNetwork,
    }),
    [
      backend,
      checkingSession,
      configError,
      deployment,
      hasParty,
      instrument,
      loadConfig,
      wrongNetwork,
    ],
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
