import { buttonClass } from '@/components/Button'
import { ConnectFace } from '@/components/ConnectFace'
import { EmptyState } from '@/components/EmptyState'

export const ConnectPrompt = (): React.JSX.Element => (
  <EmptyState
    level={1}
    title="Canton Vesting"
    action={
      <ConnectFace
        className={buttonClass('primary', 'lg')}
        cancelClassName={buttonClass('secondary', 'lg')}
      />
    }
  />
)
