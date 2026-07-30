import { Placeholder } from '@bootnodedev/canton-dappbooster'
import { RoleToggle } from './RoleToggle'
import { ThemeToggle } from './ThemeToggle'
import { WalletControl } from './WalletControl'

interface TopBarProps {
  title: string
  crumb?: string
}

export const TopBar = ({ title, crumb }: TopBarProps): React.JSX.Element => (
  <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
      <div>
        {crumb !== undefined && (
          <div className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-fg-muted">
            {crumb}
          </div>
        )}
        <h1 className="text-xl font-extrabold tracking-tight text-fg">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* TEMP(#31): kit build + theming pipeline proof, shown only once connected —
            replaced by the real <Identifier> primitive in #6. */}
        <Placeholder />
        <RoleToggle />
        <ThemeToggle />
        <WalletControl />
      </div>
    </div>
  </header>
)
