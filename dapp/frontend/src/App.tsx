import { type CantonConnectConfig, CantonConnectProvider } from '@bootnodedev/canton-connect'
import { ThemeProvider, TokenListProvider } from '@bootnodedev/canton-dappbooster'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/toast'
import { TOKENS } from '@/lib/tokens'
import { BackendProvider } from '@/providers/BackendProvider'
import { routes } from '@/routes'

const router = createBrowserRouter(routes)

// Out here so the provider's memoized SDK survives every re-render.
const connectConfig: CantonConnectConfig = { appName: 'Canton Vesting' }

export const App = (): React.JSX.Element => (
  <ThemeProvider>
    <TokenListProvider tokens={TOKENS}>
      <CantonConnectProvider config={connectConfig}>
        <BackendProvider>
          <RouterProvider router={router} />
          <Toaster />
        </BackendProvider>
      </CantonConnectProvider>
    </TokenListProvider>
  </ThemeProvider>
)
