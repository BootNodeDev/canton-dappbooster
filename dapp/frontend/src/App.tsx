import { type CantonConnectConfig, CantonConnectProvider } from '@bootnodedev/canton-connect'
import { ThemeProvider } from '@bootnodedev/canton-dappbooster'
import { RemoteAdapter } from '@canton-network/dapp-sdk'
import { LucideProvider } from 'lucide-react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Backend } from '@/providers/Backend'
import { Tokens } from '@/providers/Tokens'
import { routes } from '@/routes'
import { WALLET_GATEWAY_URL } from '@/utils/config'

const router = createBrowserRouter(routes)

// Registered at init rather than typed into the SDK picker, because RemoteAdapter.restore()
// matches the stored discovery URL against a registered rpcUrl and finds nothing otherwise.
const connectConfig: CantonConnectConfig = {
  appName: 'Canton Vesting',
  additionalAdapters: [new RemoteAdapter({ name: 'Wallet Gateway', rpcUrl: WALLET_GATEWAY_URL })],
}

export const App = (): React.JSX.Element => (
  <LucideProvider size={18} strokeWidth={1.8}>
    <ThemeProvider>
      <CantonConnectProvider config={connectConfig}>
        <Backend>
          <Tokens>
            <RouterProvider router={router} />
          </Tokens>
        </Backend>
      </CantonConnectProvider>
    </ThemeProvider>
  </LucideProvider>
)
