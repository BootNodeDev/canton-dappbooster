import { useAccount } from '@bootnodedev/canton-connect'
import { ConnectFace } from '@/components/ConnectFace'
import { Spinner } from '@/components/Spinner'
import { AccountMenu } from '@/components/TopBar/AccountMenu'
import { ConnectGuide } from '@/components/TopBar/ConnectGuide'
import { Logo } from '@/components/TopBar/Logo'
import { ThemeToggle } from '@/components/TopBar/ThemeToggle'
import { useBackend } from '@/providers/Backend'

export const TopBar = (): React.JSX.Element => {
  const { account } = useAccount()
  const { sessionPending } = useBackend()
  const wallet = account !== undefined ? <AccountMenu account={account} /> : <ConnectFace />

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
        <Logo />

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ConnectGuide />
          {sessionPending ? (
            <span
              role="status"
              className="inline-flex size-9 items-center justify-center text-fg-muted"
            >
              <Spinner />
              <span className="sr-only">Restoring wallet session</span>
            </span>
          ) : (
            wallet
          )}
        </div>
      </div>
    </header>
  )
}
