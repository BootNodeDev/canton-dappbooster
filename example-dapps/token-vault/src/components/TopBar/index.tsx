import { useAccount } from '@bootnodedev/canton-connect'
import { DisconnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { buttonClass } from '@/components/Button'
import { ConnectFace } from '@/components/ConnectFace'
import { Spinner } from '@/components/Spinner'
import { AccountMenu, accountLabel } from '@/components/TopBar/AccountMenu'
import { ConnectGuide, hasSeenGuide } from '@/components/TopBar/ConnectGuide'
import { Logo } from '@/components/TopBar/Logo'
import { MobileMenu } from '@/components/TopBar/MobileMenu'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import { roundButtonClass, ThemeToggle } from '@/components/TopBar/ThemeToggle'
import { useBackend } from '@/providers/Backend'
import { useVaultStore } from '@/store/useVaultStore'
import { cn } from '@/utils/cn'
import { countToFund } from '@/utils/requestState'

const HELP = 'How to connect a wallet'

export const TopBar = (): React.JSX.Element => {
  const { account } = useAccount()
  const { sessionPending } = useBackend()
  const [guideOpen, setGuideOpen] = useState(() => !hasSeenGuide())
  const requests = useVaultStore((state) => state.requests)
  const toFund = countToFund(requests, Date.now())

  const wallet = sessionPending ? (
    <span role="status" className="inline-flex size-9 items-center justify-center text-fg-muted">
      <Spinner />
      <span className="sr-only">Restoring wallet session</span>
    </span>
  ) : account !== undefined ? (
    <AccountMenu account={account} />
  ) : (
    <ConnectFace />
  )

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[var(--header-bg)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <Logo />

        <div className="flex items-center gap-2">
          <ThemeToggle className="max-md:hidden" />
          <button
            type="button"
            aria-label={HELP}
            onClick={() => setGuideOpen(true)}
            className={cn(roundButtonClass, 'max-md:hidden')}
          >
            <CircleHelp size={17} />
          </button>
          {wallet}
          <MobileMenu
            account={(close) =>
              account !== undefined && (
                <div className="mb-2 flex items-center gap-3 rounded-control bg-surface-2 p-3">
                  <PartyAvatar partyId={account.partyId} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">
                      {accountLabel(account)}
                    </p>
                    <p className="truncate text-xs text-fg-muted">{account.networkId}</p>
                  </div>
                  <DisconnectButton className={buttonClass('secondary', 'sm')} onClick={close}>
                    Disconnect
                  </DisconnectButton>
                </div>
              )
            }
            action={() =>
              account === undefined && (
                <ConnectFace
                  className={buttonClass('primary', 'lg', 'w-full rounded-full')}
                  cancelClassName={buttonClass('secondary', 'lg', 'w-full rounded-full')}
                />
              )
            }
            help={{ label: 'How to connect', open: () => setGuideOpen(true) }}
            links={[{ to: '/', label: 'Vault', count: toFund }]}
          />
        </div>
      </div>
      {guideOpen && <ConnectGuide onClose={() => setGuideOpen(false)} />}
    </header>
  )
}
