import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router-dom'
import { DashboardIcon, InboxIcon, PlusCircleIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useVestingStore } from '@/store/useVestingStore'
import { useParty } from '@/wallet/hooks'

interface NavItem {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

const items: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/proposals', label: 'Proposals', Icon: InboxIcon },
  { to: '/create', label: 'Create grant', Icon: PlusCircleIcon },
]

export const Sidebar = (): React.JSX.Element => {
  const { party } = useParty()
  const proposals = useVestingStore((s) => s.proposals)
  const incoming =
    party === undefined ? 0 : proposals.filter((p) => p.receiver === party.partyId).length

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/70 px-3.5 py-6 lg:flex">
      <div className="flex items-center gap-2.5 px-2 pb-7">
        <span className="size-8 rounded-xl bg-[image:var(--gradient-brand)] shadow-[var(--glow)]" />
        <div className="leading-tight">
          <div className="text-[0.95rem] font-extrabold tracking-tight text-fg">Canton Vesting</div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-fg-muted">
            cc-vesting
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-primary-soft text-fg shadow-[inset_2px_0_0_var(--primary)]'
                  : 'text-fg-muted hover:bg-muted hover:text-fg',
              )
            }
          >
            <Icon width={18} height={18} />
            <span className="flex-1">{label}</span>
            {to === '/proposals' && incoming > 0 && (
              <span className="rounded-full bg-pink px-2 py-0.5 font-mono text-[0.65rem] font-bold text-white">
                {incoming}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-border px-2 pt-4 text-xs text-fg-muted">
        <span className="size-1.5 rounded-full bg-success" />
        Canton · direct ledger
      </div>
    </aside>
  )
}
