import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { NavLink, type NavLinkRenderProps } from 'react-router-dom'
import { AccountMenu } from '@/components/TopBar/AccountMenu'
import { Logo } from '@/components/TopBar/Logo'
import { ThemeToggle } from '@/components/TopBar/ThemeToggle'
import { useParty } from '@/hooks/useParty'
import { SpinnerIcon } from '@/icons'
import { useBackend } from '@/providers/Backend'
import { useVestingStore } from '@/store/useVestingStore'
import { cn } from '@/utils/cn'

const items = [
  { to: '/', label: 'Grants' },
  { to: '/pending', label: 'Pending' },
]

export const TopBar = (): React.JSX.Element => {
  const { isLocked, party } = useParty()
  const { sessionPending } = useBackend()
  // The connect face answers a session still reading its account and one whose read failed alike:
  // it renders its own pending copy for the first and retries for the second.
  const wallet = party !== undefined || isLocked ? <AccountMenu /> : <ConnectButton />
  const pendingGrants = useVestingStore((s) => s.pendingGrants)
  const incoming =
    party === undefined ? 0 : pendingGrants.filter((p) => p.receiver === party.partyId).length

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
        <Logo />

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {sessionPending ? (
            <span
              role="status"
              className="inline-flex size-9 items-center justify-center text-fg-muted"
            >
              <SpinnerIcon width={18} height={18} />
              <span className="sr-only">Restoring wallet session</span>
            </span>
          ) : (
            wallet
          )}
        </div>
      </div>

      {/* Centred over the row above from md, where there is room beside the logo and the wallet
          control; below that it takes a row of its own, since hiding it left Pending reachable
          only by typing the URL. */}
      <nav
        aria-label="Primary"
        className="flex items-center gap-1 border-t border-border px-5 py-2 sm:px-8 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:border-0 md:p-0"
      >
        {items.map(({ to, label }) => (
          <NavLink
            end
            key={to}
            to={to}
            className={({ isActive }: NavLinkRenderProps) =>
              cn(
                'flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-sm font-semibold transition-colors',
                isActive ? 'bg-primary-soft text-fg' : 'text-fg-muted hover:text-fg',
              )
            }
          >
            {label}
            {to === '/pending' && incoming > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="rounded-full bg-pink-strong px-2 py-0.5 font-mono text-[0.65rem] font-bold text-white"
                >
                  {incoming}
                </span>
                <span className="sr-only">({incoming} awaiting you)</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
