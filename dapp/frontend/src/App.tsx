import { ConnectKitProvider } from 'canton-connect-kit'
import type { JSX } from 'react'
import { useState } from 'react'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { ConnectionBar } from './ConnectionBar'
import { LoyaltyCard } from './features/loyalty/index'
import { SignMessageDemo } from './features/sign-message/index'
import { loadRuntimeConfig } from './runtimeConfig'

const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

// dApp starter shell. Everything under src/features/<name>/ is a removable demo:
// to drop one, delete its folder + its import and <…/> line below, plus
// ../e2e/tests/features/<name>/. See README "Removing a feature".
export const App = (): JSX.Element => {
  const [runtimeConfig] = useState(() => loadRuntimeConfig())
  // /sign-demo serves the standalone signMessage example; every other path is
  // the Stampbook app. Keeps the off-topic demo out of the product UI while
  // leaving it reachable (and e2e-testable) on its own route.
  const isSignDemo = window.location.pathname === '/sign-demo'
  return (
    <TooltipProvider>
      <ToastProvider>
        <ConnectKitProvider
          config={{
            appName: 'dAppBooster Canton Stampbook',
            appDescription: 'On-ledger loyalty stamp cards on Canton',
            network: runtimeConfig.cantonNetwork,
            walletConnectProjectId: envString('VITE_WC_PROJECT_ID'),
          }}
        >
          <ConnectionBar>{isSignDemo ? <SignMessageDemo /> : <LoyaltyCard />}</ConnectionBar>
        </ConnectKitProvider>
      </ToastProvider>
    </TooltipProvider>
  )
}
