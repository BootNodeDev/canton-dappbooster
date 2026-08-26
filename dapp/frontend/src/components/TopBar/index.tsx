import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { NavLink, type NavLinkRenderProps } from 'react-router-dom'
import { Logo } from '@/components/TopBar/Logo'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import { ThemeToggle } from '@/components/TopBar/ThemeToggle'
import { useParty } from '@/hooks/useParty'
import { SpinnerIcon } from '@/icons'
import { useBackend } from '@/providers/Backend'
import { useVestingStore } from '@/store/useVestingStore'
import { cn } from '@/utils/cn'

const items = [
  { to: '/', label: 'Grants' },
  { to: '/proposals', label: 'Proposals' },
]

export const TopBar = (): React.JSX.Element => {
  const { party } = useParty()
  const { sessionPending } = useBackend()
  const proposals = useVestingStore((s) => s.proposals)
  const incoming =
    party === undefined ? 0 : proposals.filter((p) => p.receiver === party.partyId).length

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="relative flex items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
        <Logo />

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
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
              {to === '/proposals' && incoming > 0 && (
                <span className="rounded-full bg-pink px-2 py-0.5 font-mono text-[0.65rem] font-bold text-white">
                  {incoming}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {sessionPending ? (
            <span
              role="status"
              className="inline-flex size-9 items-center justify-center text-fg-muted"
            >
              <SpinnerIcon width={18} height={18} />
            </span>
          ) : (
            <ConnectButton avatar={(partyId) => <PartyAvatar partyId={partyId} />} />
          )}
        </div>
      </div>
    </header>
  )
}
