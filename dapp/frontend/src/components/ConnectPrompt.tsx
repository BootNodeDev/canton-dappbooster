import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { EmptyState } from '@/components/EmptyState'

// Stands in wherever a page's ledger data would be, so the shell and its ConnectButton stay
// reachable instead of a gate replacing the whole app.
export const ConnectPrompt = ({ description }: { description: string }): React.JSX.Element => (
  <EmptyState
    title="Connect your wallet"
    description={description}
    action={<ConnectButton className="mt-2" mode="connect" />}
  />
)
