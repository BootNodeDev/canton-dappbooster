import { Logo } from '@/components/Logo'
import { PLAIN_ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { MENU_ICON } from '@/components/ui/icons'
import { cn } from '@/utils/cn'
import { useVault } from '@/vault/useVault'

interface HeaderProps {
  onOpenMenu: () => void
}

export const Header = ({ onOpenMenu }: HeaderProps): JSX.Element => {
  const vault = useVault()
  return (
    <header className="flex items-center gap-3 pl-1 pr-1 pt-2 pb-3 mb-1">
      <Logo size={36} />
      <div className="grow min-w-0 leading-none">
        <h1 className="font-display text-[1.55rem] font-semibold m-0 text-foreground tracking-[-0.025em] lowercase">
          carpincho
        </h1>
      </div>
      {!vault.isLocked && (
        <button
          type="button"
          data-testid="menu-open"
          onClick={onOpenMenu}
          aria-label="Menu"
          title="Menu"
          className={cn(PLAIN_ICON_BUTTON_CLASS, 'size-9 [&_svg]:size-6')}
        >
          {MENU_ICON}
        </button>
      )}
    </header>
  )
}
