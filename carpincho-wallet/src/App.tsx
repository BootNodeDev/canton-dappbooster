import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { MenuSheet } from '@/components/menu/MenuSheet'
import { SPINNER_ICON } from '@/components/ui/icons'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { createQueryClient } from '@/config/queryClient'
import { cn } from '@/utils/cn'
import { useVault } from '@/vault/useVault'
import type { VaultContextValue } from '@/vault/VaultContext'
import { VaultProvider } from '@/vault/VaultContext'
import { HomeView } from '@/views/HomeView'
import { OnboardingFlow } from '@/views/onboarding/OnboardingFlow'
import { UnlockView } from '@/views/UnlockView'

const queryClient = createQueryClient()

export type ShellView = 'loading' | 'unlock' | 'onboarding' | 'home'

// First-run routing; order matters. Both onboarding cases (no vault, or unlocked vault
// with no account) collapse to one branch; OnboardingFlow runs the vault/RPC/account steps.
export const selectShellView = (
  v: Pick<VaultContextValue, 'isLoading' | 'hasVault' | 'isLocked' | 'accounts'>,
): ShellView => {
  if (v.isLoading) return 'loading'
  if (!v.hasVault) return 'onboarding'
  if (v.isLocked) return 'unlock'
  if (v.accounts.length === 0) return 'onboarding'
  return 'home'
}

const Shell = (): JSX.Element => {
  const v = useVault()
  const [menuOpen, setMenuOpen] = useState(false)
  const view = selectShellView(v)
  const showHeader = view === 'home'
  useEffect(() => {
    if (!showHeader) setMenuOpen(false)
  }, [showHeader])
  if (view === 'loading') {
    return (
      <div className="w-popup mx-auto px-3 pt-3 pb-8 min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        {SPINNER_ICON}
        <p className="m-0 font-sans text-[0.95rem] font-medium">Loading...</p>
      </div>
    )
  }
  return (
    <div
      className={cn(
        'w-popup mx-auto px-3 pt-3',
        // Home is a fixed-height shell (only the tab body scrolls); other views flow naturally.
        view === 'home' ? 'flex h-screen flex-col' : 'pb-8',
      )}
    >
      {showHeader && <Header onOpenMenu={() => setMenuOpen(true)} />}
      {view === 'unlock' && <UnlockView />}
      {view === 'onboarding' && <OnboardingFlow />}
      {view === 'home' && <HomeView />}
      {showHeader && (
        <MenuSheet
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      )}
    </div>
  )
}

const App = (): JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <VaultProvider>
      <TooltipProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </TooltipProvider>
    </VaultProvider>
  </QueryClientProvider>
)

export default App
