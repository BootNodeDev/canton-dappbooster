import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { buttonClass } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export const ConnectPrompt = (): React.JSX.Element => (
  <EmptyState
    level={1}
    title="Canton Vesting"
    action={<ConnectButton className={buttonClass('primary', 'lg')} />}
  />
)
