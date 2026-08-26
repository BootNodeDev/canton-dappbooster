import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { buttonClass } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

// Stands in wherever a page's ledger data would be, so the shell and its ConnectButton stay
// reachable instead of a gate replacing the whole app. Styled as the app's primary button, since
// here it is the call to action rather than the header's quiet chip.
export const ConnectPrompt = (): React.JSX.Element => (
  <EmptyState
    level={1}
    title="Canton Vesting"
    action={<ConnectButton className={buttonClass('primary', 'lg')} mode="connect" />}
  />
)
