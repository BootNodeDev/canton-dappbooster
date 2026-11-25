import { useAccount } from '@bootnodedev/canton-connect'
import { DisconnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { CircleHelp, Plus } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { buttonClass } from '@/components/Button'
import { ConnectFace } from '@/components/ConnectFace'
import { Spinner } from '@/components/Spinner'
import { AccountMenu, shortParty } from '@/components/TopBar/AccountMenu'
import { ConnectGuide } from '@/components/TopBar/ConnectGuide'
import { Logo } from '@/components/TopBar/Logo'
import { type MenuLink, MobileMenu } from '@/components/TopBar/MobileMenu'
import { NavCount } from '@/components/TopBar/NavCount'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import { roundButtonClass, ThemeToggle } from '@/components/TopBar/ThemeToggle'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { lensSearch, useRoleLens } from '@/hooks/useRoleLens'
import { useBackend } from '@/providers/Backend'
import { useVestingStore } from '@/store/useVestingStore'
import { cn } from '@/utils/cn'

const HELP = 'How to connect a wallet'

export const TopBar = (): React.JSX.Element => {
  const { account } = useAccount()
  const { sessionPending } = useBackend()
  const [role] = useRoleLens()
  const [, setCreating] = useCreateGrant()
  const [guideOpen, setGuideOpen] = useState(false)
  const pendingGrants = useVestingStore((s) => s.pendingGrants)
  const incoming =
    account === undefined ? 0 : pendingGrants.filter((p) => p.receiver === account.partyId).length

  // The lens rides along, so moving between the pages keeps the view the reader picked.
  const search = lensSearch(role)
  const links: MenuLink[] = [
    { to: { pathname: '/', search }, label: 'Grants' },
    { to: { pathname: '/pending', search }, label: 'Pending', count: incoming },
  ]

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
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-8 md:grid-cols-[1fr_auto_1fr]">
        <Logo search={search} />

        <nav aria-label="Primary" className="nav hidden items-center md:flex">
          {links.map(({ to, label, count }) => (
            <NavLink className="nav-link" end key={label} to={to}>
              {label}
              <NavCount count={count} />
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-2">
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
                    <p className="truncate font-mono text-sm font-semibold text-fg">
                      {shortParty(account.partyId)}
                    </p>
                    <p className="text-xs break-words text-fg-muted">
                      Connected to {account.networkId}
                    </p>
                  </div>
                  <DisconnectButton className={buttonClass('secondary', 'sm')} onClick={close}>
                    Disconnect
                  </DisconnectButton>
                </div>
              )
            }
            action={(close) =>
              account !== undefined ? (
                <button
                  type="button"
                  className={buttonClass('primary', 'lg', 'w-full rounded-full')}
                  onClick={() => {
                    close()
                    setCreating(true)
                  }}
                >
                  <Plus size={18} />
                  Create grant
                </button>
              ) : (
                <ConnectFace
                  className={buttonClass('primary', 'lg', 'w-full rounded-full')}
                  cancelClassName={buttonClass('secondary', 'lg', 'w-full rounded-full')}
                />
              )
            }
            help={{ label: 'How to connect', open: () => setGuideOpen(true) }}
            links={links}
          />
        </div>
      </div>
      {guideOpen && <ConnectGuide onClose={() => setGuideOpen(false)} />}
    </header>
  )
}
