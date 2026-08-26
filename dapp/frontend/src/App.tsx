import { type CantonConnectConfig, CantonConnectProvider } from '@bootnodedev/canton-connect'
import { ThemeProvider, TokenListProvider } from '@bootnodedev/canton-dappbooster'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Backend } from '@/providers/Backend'
import { routes } from '@/routes'
import { TOKENS } from '@/utils/tokens'

const router = createBrowserRouter(routes)

// Out here so the provider's memoized SDK survives every re-render.
const connectConfig: CantonConnectConfig = { appName: 'Canton Vesting' }

export const App = (): React.JSX.Element => (
  <ThemeProvider>
    <TokenListProvider tokens={TOKENS}>
      <CantonConnectProvider config={connectConfig}>
        <Backend>
          <RouterProvider router={router} />
        </Backend>
      </CantonConnectProvider>
    </TokenListProvider>
  </ThemeProvider>
)
