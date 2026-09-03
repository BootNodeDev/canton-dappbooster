import { type CantonConnectConfig, CantonConnectProvider } from '@bootnodedev/canton-connect'
import { ThemeProvider, TokenListProvider } from '@bootnodedev/canton-dappbooster'
import { LucideProvider } from 'lucide-react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Backend } from '@/providers/Backend'
import { routes } from '@/routes'
import { TOKENS } from '@/utils/tokens'

const router = createBrowserRouter(routes)

// Out here so the provider's memoized SDK survives every re-render.
const connectConfig: CantonConnectConfig = { appName: 'Canton Vesting' }

// Lucide's defaults for the whole app, so a call site passes `size` only when it wants another.
export const App = (): React.JSX.Element => (
  <LucideProvider size={18} strokeWidth={1.8}>
    <ThemeProvider>
      <TokenListProvider tokens={TOKENS}>
        <CantonConnectProvider config={connectConfig}>
          <Backend>
            <RouterProvider router={router} />
          </Backend>
        </CantonConnectProvider>
      </TokenListProvider>
    </ThemeProvider>
  </LucideProvider>
)
