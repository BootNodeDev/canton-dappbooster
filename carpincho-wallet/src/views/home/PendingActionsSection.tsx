import { Alert } from '@/components/ui/Alert'
import { PendingActionCard } from '@/components/ui/PendingActionCard'
import { shortMiddle } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'
import type {
  PendingConnectRequest,
  PendingExecuteRequest,
  PendingSignRequest,
} from '@/views/home/types'
import type { PendingActions } from '@/views/home/usePendingActions'
import { CANTON_METHOD_CONNECT, CANTON_METHOD_SIGN_MESSAGE, type ProposalEvent } from '@/wc/client'

interface PendingActionsSectionProps extends PendingActions {
  proposal: ProposalEvent | undefined
  pendingConnect: PendingConnectRequest | undefined
  pendingSign: PendingSignRequest | undefined
  pendingExecute: PendingExecuteRequest | undefined
  proposalAccount: string | null
  accountsSorted: AccountPublic[]
  busy: boolean
}

// Shows the requesting dApp origin so the user knows who they are approving.
const OriginNote = ({ origin }: { origin: string | undefined }): JSX.Element | null =>
  origin === undefined || origin === '' ? null : (
    <div className="min-w-0 break-all font-mono text-[0.84rem] font-medium text-muted-foreground">
      origin: <span className="text-foreground">{origin}</span>
    </div>
  )

// Renders the single active pending request (connect, message sign, or prepare-execute).
export const PendingActionsSection = ({
  proposal,
  pendingConnect,
  pendingSign,
  pendingExecute,
  proposalAccount,
  accountsSorted,
  busy,
  onApproveProposal,
  onRejectProposal,
  onApproveConnect,
  onRejectConnect,
  onApproveSign,
  onRejectSign,
  onApproveExecute,
  onRejectExecute,
}: PendingActionsSectionProps): JSX.Element => {
  // Connect always uses the active account; proposalAccount mirrors it.
  const connectAccount = accountsSorted.find((a) => a.id === proposalAccount) ?? accountsSorted[0]

  return (
    <>
      {proposal !== undefined ? (
        <PendingActionCard
          method={CANTON_METHOD_CONNECT}
          approveLabel="Connect"
          approveDisabled={busy || proposalAccount === null}
          onApprove={onApproveProposal}
          onReject={onRejectProposal}
          busy={busy}
          payload={{ json: proposal.params }}
        >
          {connectAccount === undefined ? (
            <Alert variant="info">Add an account first before approving.</Alert>
          ) : (
            <div className="font-mono text-[0.84rem] font-medium text-muted-foreground">
              account:{' '}
              <span className="text-foreground">{shortMiddle(connectAccount.partyId, 12, 7)}</span>
            </div>
          )}
        </PendingActionCard>
      ) : pendingConnect !== undefined ? (
        <PendingActionCard
          method={CANTON_METHOD_CONNECT}
          approveLabel="Connect"
          approveDisabled={busy || accountsSorted.length === 0}
          onApprove={onApproveConnect}
          onReject={onRejectConnect}
          busy={busy}
        >
          {accountsSorted.length === 0 ? (
            <Alert variant="info">Add an account first before connecting.</Alert>
          ) : (
            <div className="flex flex-col gap-2">
              <OriginNote origin={pendingConnect.origin} />
              <p className="text-[0.85rem] text-muted-foreground">
                Allow this site to see your accounts and request signatures.
              </p>
            </div>
          )}
        </PendingActionCard>
      ) : pendingSign !== undefined ? (
        <PendingActionCard
          method={CANTON_METHOD_SIGN_MESSAGE}
          approveLabel="Sign"
          onApprove={onApproveSign}
          onReject={onRejectSign}
          busy={busy}
          payload={{ json: pendingSign.messageBase64 }}
        >
          <OriginNote origin={pendingSign.origin} />
        </PendingActionCard>
      ) : pendingExecute !== undefined ? (
        <PendingActionCard
          method={pendingExecute.rawMethod}
          approveLabel="Approve"
          onApprove={onApproveExecute}
          onReject={onRejectExecute}
          busy={busy}
          payload={{ json: pendingExecute.params }}
        >
          <OriginNote origin={pendingExecute.origin} />
        </PendingActionCard>
      ) : null}
    </>
  )
}
