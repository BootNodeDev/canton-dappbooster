import { useConnect } from '@bootnodedev/canton-connect'
import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { buttonClass } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export const ConnectPrompt = (): React.JSX.Element => {
  const { isConnecting } = useConnect()

  return (
    <EmptyState
      level={1}
      title="Canton Vesting"
      action={
        <>
          <ConnectButton className={buttonClass('primary', 'lg')} />
          {isConnecting && (
            <p aria-hidden="true" className="mt-2 text-xs text-fg-muted">
              (click to cancel)
            </p>
          )}
        </>
      }
    />
  )
}
