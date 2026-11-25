import { truncateIdentifier } from '@bootnodedev/canton-dappbooster'
import { Plus } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { buttonClass } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { AccountMenu } from '@/components/TopBar/AccountMenu'
import { Logo } from '@/components/TopBar/Logo'
import { type MenuLink, MobileMenu } from '@/components/TopBar/MobileMenu'
import { NavCount } from '@/components/TopBar/NavCount'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import { ThemeToggle } from '@/components/TopBar/ThemeToggle'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { lensSearch, useRoleLens } from '@/hooks/useRoleLens'
import { useSession } from '@/providers/Session'
import { useVestingStore } from '@/store/useVestingStore'
import { errorText } from '@/utils/errorText'
import { toast } from '@/utils/toast'

export const TopBar = (): React.JSX.Element => {
  const { logout, pending: sessionPending, session } = useSession()
  const [role] = useRoleLens()
  const [, setCreating] = useCreateGrant()
  const pendingGrants = useVestingStore((s) => s.pendingGrants)
  const incoming =
    session === undefined ? 0 : pendingGrants.filter((p) => p.receiver === session.partyId).length

  // The lens rides along, so moving between the pages keeps the view the reader picked.
  const search = lensSearch(role)
  const links: MenuLink[] = [
    { to: { pathname: '/', search }, label: 'Grants' },
    { to: { pathname: '/pending', search }, label: 'Pending', count: incoming },
  ]

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
          {sessionPending ? (
            <span
              role="status"
              className="inline-flex size-9 items-center justify-center text-fg-muted"
            >
              <Spinner />
              <span className="sr-only">Restoring session</span>
            </span>
          ) : (
            session !== undefined && <AccountMenu session={session} />
          )}
          <MobileMenu
            account={(close) =>
              session !== undefined && (
                <div className="mb-2 flex items-center gap-3 rounded-control bg-surface-2 p-3">
                  <PartyAvatar partyId={session.partyId} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{session.username}</p>
                    <p className="font-mono text-xs break-words text-fg-muted">
                      Party {truncateIdentifier(session.partyId, { head: 6, hint: 12, tail: 6 })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={buttonClass('secondary', 'sm')}
                    onClick={() => {
                      close()
                      logout().catch((err: unknown) => toast.error(errorText(err)))
                    }}
                  >
                    Log out
                  </button>
                </div>
              )
            }
            action={(close) =>
              session !== undefined && (
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
              )
            }
            links={links}
          />
        </div>
      </div>
    </header>
  )
}
