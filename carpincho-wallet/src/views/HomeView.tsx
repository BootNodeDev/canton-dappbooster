import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountCard } from '@/components/AccountCard'
import { ConnectionFooter } from '@/components/ConnectionFooter'
import { HomeTabs } from '@/components/HomeTabs'
import { DangerConfirm } from '@/components/ui/DangerConfirm'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/toast'
import { useExtensionDappConnection } from '@/extension/dappConnection'
import { forgetConnectedOrigin, isExtensionRuntime } from '@/extension/runtimeClient'
import { useWalletServiceStatus } from '@/hooks/useWalletServiceStatus'
import { sortAccounts } from '@/utils/account'
import { useVault } from '@/vault/useVault'
import { ConnectionSettingsView } from '@/views/ConnectionSettingsView'
import { PendingActionsSection } from '@/views/home/PendingActionsSection'
import type {
  PendingConnectRequest,
  PendingExecuteRequest,
  PendingSignRequest,
} from '@/views/home/types'
import { useExtensionRequests } from '@/views/home/useExtensionRequests'
import { usePendingActions } from '@/views/home/usePendingActions'
import { useProviderRequestHandler } from '@/views/home/useProviderRequestHandler'
import { useWalletConnectLifecycle } from '@/views/home/useWalletConnectLifecycle'
import type { AccountSnapshot } from '@/wc/accounts'
import {
  type ConnectedDappSession,
  disconnectSession,
  getConnectedDappSessions,
  type ProposalEvent,
} from '@/wc/client'

export const HomeView = (): JSX.Element => {
  const v = useVault()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)
  const [sessions, setSessions] = useState<ConnectedDappSession[]>([])
  const [proposal, setProposal] = useState<ProposalEvent | undefined>(undefined)
  const [pendingConnect, setPendingConnect] = useState<PendingConnectRequest | undefined>(undefined)
  const [pendingSign, setPendingSign] = useState<PendingSignRequest | undefined>(undefined)
  const [pendingExecute, setPendingExecute] = useState<PendingExecuteRequest | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const accountSnapshotRef = useRef<AccountSnapshot>({ accounts: v.accounts, primary: v.primary })
  const extensionMode = isExtensionRuntime()
  const walletService = useWalletServiceStatus()

  // Connect proposals always use the active account; no in-flow account picker any more.
  const proposalAccount =
    proposal === undefined ? null : (v.primary?.id ?? v.accounts[0]?.id ?? null)

  useEffect(() => {
    accountSnapshotRef.current = { accounts: v.accounts, primary: v.primary }
  }, [v.accounts, v.primary])

  const closeExtensionPopup = useCallback((): void => {
    if (!extensionMode) {
      return
    }
    window.close()
  }, [extensionMode])

  const resolveAccounts = useCallback(
    () => ({
      accounts: accountSnapshotRef.current.accounts,
      primary: accountSnapshotRef.current.primary,
    }),
    [],
  )

  const refreshSessions = useCallback(async (): Promise<void> => {
    setSessions(await getConnectedDappSessions())
  }, [])

  const handleProviderRequest = useProviderRequestHandler(
    resolveAccounts,
    setPendingConnect,
    setPendingSign,
    setPendingExecute,
  )

  useWalletConnectLifecycle({ extensionMode, handleProviderRequest, setSessions, setProposal })
  useExtensionRequests({ extensionMode, handleProviderRequest })

  const pendingActions = usePendingActions({
    vault: v,
    proposal,
    proposalAccount,
    pendingConnect,
    pendingSign,
    pendingExecute,
    setProposal,
    setPendingConnect,
    setPendingSign,
    setPendingExecute,
    setBusy,
    refreshSessions,
    closeExtensionPopup,
  })

  const onDisconnectDapp = async (topic: string): Promise<void> => {
    setBusy(true)
    try {
      await disconnectSession(topic)
      await refreshSessions()
    } catch (err) {
      toast.error(`Disconnect failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const accountsSorted = useMemo(() => sortAccounts(v.accounts), [v.accounts])
  // HomeView only renders when an account exists, so a primary is always available.
  const primary = v.primary ?? accountsSorted[0]
  const hasPending =
    proposal !== undefined ||
    pendingConnect !== undefined ||
    pendingSign !== undefined ||
    pendingExecute !== undefined
  const dapp = useExtensionDappConnection({
    extensionMode,
    sessions,
  })
  const connectedSession = sessions[0]
  // Disconnect, run only after the confirmation dialog is accepted.
  const performDisconnect = ((): (() => void) | undefined => {
    if (extensionMode) {
      if (dapp.kind !== 'connected') {
        return undefined
      }
      const { origin } = dapp
      return () => {
        void forgetConnectedOrigin(origin).catch((err: Error) =>
          toast.error(`Disconnect failed: ${err.message}`),
        )
      }
    }
    return connectedSession === undefined
      ? undefined
      : () => {
          void onDisconnectDapp(connectedSession.topic)
        }
  })()
  const connectedLabel = dapp.kind === 'connected' ? dapp.label : ''
  const connectedOrigin = dapp.kind === 'connected' ? dapp.origin : ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-3">
        <AccountCard primary={primary} />
      </div>

      <HomeTabs
        account={primary}
        transactions={v.transactions}
      />

      {/* Approval requests are modal: explicit approve/reject only, no dismiss affordance. */}
      <Sheet
        open={hasPending}
        onOpenChange={() => undefined}
        testId="approval-sheet"
        side="center"
        title="Awaiting approval"
        description="Review and approve or reject this dApp request."
        hideClose
      >
        <PendingActionsSection
          proposal={proposal}
          pendingConnect={pendingConnect}
          pendingSign={pendingSign}
          pendingExecute={pendingExecute}
          proposalAccount={proposalAccount}
          accountsSorted={accountsSorted}
          busy={busy}
          {...pendingActions}
        />
      </Sheet>

      <Sheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        testId="connection-settings-sheet"
        title="Connection"
        description="Configure wallet-service URL and network."
      >
        <ConnectionSettingsView />
      </Sheet>

      <Sheet
        open={disconnectConfirmOpen}
        onOpenChange={setDisconnectConfirmOpen}
        testId="disconnect-confirm-sheet"
        side="center"
        title={`Disconnect ${connectedLabel}?`}
        description="Disconnect this dApp from the wallet."
      >
        <DangerConfirm
          identifier={connectedOrigin}
          message={
            <>
              <span className="font-semibold text-foreground">{connectedLabel}</span> will be
              disconnected from this wallet.
            </>
          }
          confirmLabel="Disconnect"
          confirmTestId="confirm-disconnect"
          onConfirm={() => {
            performDisconnect?.()
            setDisconnectConfirmOpen(false)
          }}
        />
      </Sheet>

      <ConnectionFooter
        walletService={walletService}
        dapp={dapp}
        onDisconnectDapp={
          performDisconnect === undefined ? undefined : () => setDisconnectConfirmOpen(true)
        }
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  )
}
