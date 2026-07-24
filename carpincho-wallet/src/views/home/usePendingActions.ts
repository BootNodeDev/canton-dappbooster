import type { Dispatch, SetStateAction } from 'react'
import { walletServiceRequest } from '@/api/walletService'
import { toast } from '@/components/ui/toast'
import { broadcastWalletEvent } from '@/extension/eventBroadcast'
import { dispatchProviderRequest } from '@/provider/dispatch'
import { CANTON_METHOD_CONNECT, CANTON_METHOD_PREPARE_EXECUTE } from '@/provider/methods'
import type { VaultContextValue } from '@/vault/VaultContext'
import {
  commandCount,
  commandSummary,
  optionalString,
  transactionCommands,
} from '@/views/home/transactionSummary'
import type {
  PendingConnectRequest,
  PendingExecuteRequest,
  PendingSignRequest,
} from '@/views/home/types'
import { approveProposal, type ProposalEvent, rejectProposal } from '@/wc/client'

interface PreparedTransactionResponse {
  preparedTransaction: string
  preparedTransactionHash: string
  hashingSchemeVersion:
    | 'HASHING_SCHEME_VERSION_UNSPECIFIED'
    | 'HASHING_SCHEME_VERSION_V2'
    | 'HASHING_SCHEME_VERSION_V3'
  hashingDetails?: string
  costEstimation?: unknown
}

interface ExecutePreparedResponse {
  updateId?: string
  completionOffset?: number
}

interface PendingActionsArgs {
  vault: VaultContextValue
  proposal: ProposalEvent | undefined
  proposalAccount: string | null
  pendingConnect: PendingConnectRequest | undefined
  pendingSign: PendingSignRequest | undefined
  pendingExecute: PendingExecuteRequest | undefined
  setProposal: Dispatch<SetStateAction<ProposalEvent | undefined>>
  setPendingConnect: Dispatch<SetStateAction<PendingConnectRequest | undefined>>
  setPendingSign: Dispatch<SetStateAction<PendingSignRequest | undefined>>
  setPendingExecute: Dispatch<SetStateAction<PendingExecuteRequest | undefined>>
  setBusy: Dispatch<SetStateAction<boolean>>
  refreshSessions: () => Promise<void>
  closeExtensionPopup: () => void
}

export interface PendingActions {
  onApproveProposal: () => Promise<void>
  onRejectProposal: () => Promise<void>
  onApproveConnect: () => Promise<void>
  onRejectConnect: () => Promise<void>
  onApproveSign: () => Promise<void>
  onRejectSign: () => Promise<void>
  onApproveExecute: () => Promise<void>
  onRejectExecute: () => Promise<void>
}

// Approve / reject side effects for the three pending request kinds, including the
// prepare → sign → execute → record → broadcast pipeline and txChanged events.
export const usePendingActions = ({
  vault,
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
}: PendingActionsArgs): PendingActions => {
  // Approve a direct injected-provider connection: only now do accounts leave the wallet,
  // and the background remembers the origin off the resulting isConnected:true response.
  const onApproveConnect = async (): Promise<void> => {
    if (pendingConnect === undefined) {
      return
    }
    setBusy(true)
    try {
      await dispatchProviderRequest(
        { method: CANTON_METHOD_CONNECT },
        () => ({ accounts: vault.accounts, primary: vault.primary }),
        pendingConnect.responder,
      )
      toast.success('Connected.')
      setPendingConnect(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await pendingConnect.responder.error(-32000, msg).catch(() => undefined)
      toast.error(`Connect failed: ${msg}`)
      setPendingConnect(undefined)
    } finally {
      setBusy(false)
      closeExtensionPopup()
    }
  }

  const onRejectConnect = async (): Promise<void> => {
    if (pendingConnect === undefined) {
      return
    }
    await pendingConnect.responder.error(4001, 'user rejected').catch(() => undefined)
    setPendingConnect(undefined)
    closeExtensionPopup()
  }

  const onApproveProposal = async (): Promise<void> => {
    if (proposal === undefined || proposalAccount === null) {
      return
    }
    const account = vault.accounts.find((a) => a.id === proposalAccount)
    if (account === undefined) {
      toast.error('Select an account first.')
      return
    }
    setBusy(true)
    try {
      await approveProposal({ proposal, partyId: account.partyId })
      await refreshSessions()
      setProposal(undefined)
      closeExtensionPopup()
    } catch (err) {
      toast.error(`Approve failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const onRejectProposal = async (): Promise<void> => {
    if (proposal === undefined) {
      return
    }
    await rejectProposal(proposal.id).catch(() => undefined)
    setProposal(undefined)
    closeExtensionPopup()
  }

  const onApproveSign = async (): Promise<void> => {
    if (pendingSign === undefined) {
      return
    }
    setBusy(true)
    try {
      const signature = await vault.signMessage(pendingSign.account.id, pendingSign.messageBase64)
      await pendingSign.responder.result({ signature })
      toast.success('Signed.')
      setPendingSign(undefined)
    } catch (err) {
      const msg = (err as Error).message
      await pendingSign.responder.error(-32000, msg).catch(() => undefined)
      toast.error(`Sign failed: ${msg}`)
      setPendingSign(undefined)
    } finally {
      setBusy(false)
      closeExtensionPopup()
    }
  }

  const onRejectSign = async (): Promise<void> => {
    if (pendingSign === undefined) {
      return
    }
    await pendingSign.responder.error(4001, 'user rejected').catch(() => undefined)
    setPendingSign(undefined)
    closeExtensionPopup()
  }

  const onApproveExecute = async (): Promise<void> => {
    if (pendingExecute === undefined) {
      return
    }
    setBusy(true)
    const cmdId = optionalString(pendingExecute.params.commandId) ?? ''
    try {
      // txChanged: pending — accepted, about to call participant prepare.
      void broadcastWalletEvent('txChanged', { status: 'pending', commandId: cmdId })
      const prepared = await walletServiceRequest<PreparedTransactionResponse>(
        'prepareTransaction',
        pendingExecute.params,
      )
      const signatureBase64 = await vault.signMessage(
        pendingExecute.account.id,
        prepared.preparedTransactionHash,
      )
      // txChanged: signed — signed locally, about to submit to the participant.
      void broadcastWalletEvent('txChanged', {
        status: 'signed',
        commandId: cmdId,
        payload: {
          preparedTransactionHash: prepared.preparedTransactionHash,
          signature: signatureBase64,
        },
      })
      const executed = await walletServiceRequest<ExecutePreparedResponse>('executePrepared', {
        ...prepared,
        partyId: pendingExecute.account.partyId,
        signatureBase64,
      })

      await vault.recordTransaction({
        accountId: pendingExecute.account.id,
        accountName: pendingExecute.account.name,
        partyId: pendingExecute.account.partyId,
        network: pendingExecute.account.network,
        method: pendingExecute.method,
        status: 'executed',
        preparedTransaction: prepared.preparedTransaction,
        preparedTransactionHash: prepared.preparedTransactionHash,
        commands: transactionCommands(pendingExecute.params),
        commandId: optionalString(pendingExecute.params.commandId),
        submissionId: optionalString(pendingExecute.params.submissionId),
        updateId: executed.updateId,
        completionOffset: executed.completionOffset,
        commandCount: commandCount(pendingExecute.params),
        summary: commandSummary(pendingExecute.params),
      })

      const tx = {
        status: 'executed',
        commandId: cmdId,
        payload: {
          updateId: executed.updateId ?? '',
          completionOffset: executed.completionOffset ?? 0,
        },
      }
      const isLegacyPrepareSign = pendingExecute.rawMethod === 'canton_prepareSignExecute'
      const result =
        pendingExecute.method === CANTON_METHOD_PREPARE_EXECUTE
          ? null
          : isLegacyPrepareSign
            ? tx
            : { tx }
      // txChanged: executed — participant accepted the submission.
      void broadcastWalletEvent('txChanged', tx)
      await pendingExecute.responder.result(result)
      toast.success('Transaction executed.')
      setPendingExecute(undefined)
    } catch (err) {
      const msg = (err as Error).message
      // txChanged: failed — submission did not complete.
      void broadcastWalletEvent('txChanged', { status: 'failed', commandId: cmdId, reason: msg })
      await pendingExecute.responder.error(-32000, msg).catch(() => undefined)
      toast.error(`Transaction failed: ${msg}`)
      setPendingExecute(undefined)
    } finally {
      setBusy(false)
      closeExtensionPopup()
    }
  }

  const onRejectExecute = async (): Promise<void> => {
    if (pendingExecute === undefined) {
      return
    }
    const cmdId = optionalString(pendingExecute.params.commandId) ?? ''
    // txChanged: failed — user declined before submission.
    void broadcastWalletEvent('txChanged', {
      status: 'failed',
      commandId: cmdId,
      reason: 'user rejected',
    })
    await pendingExecute.responder.error(4001, 'user rejected').catch(() => undefined)
    setPendingExecute(undefined)
    closeExtensionPopup()
  }

  return {
    onApproveProposal,
    onRejectProposal,
    onApproveConnect,
    onRejectConnect,
    onApproveSign,
    onRejectSign,
    onApproveExecute,
    onRejectExecute,
  }
}
