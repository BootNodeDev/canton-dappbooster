import { type CantonConnectConfig, CantonConnectProvider } from '@bootnodedev/canton-connect'
import { ThemeProvider } from '@bootnodedev/canton-dappbooster'
import { LucideProvider } from 'lucide-react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Backend } from '@/providers/Backend'
import { Tokens } from '@/providers/Tokens'
import { routes } from '@/routes'

const router = createBrowserRouter(routes)

const connectConfig: CantonConnectConfig = { appName: 'Canton Vesting' }

export const App = (): React.JSX.Element => (
  <LucideProvider size={18} strokeWidth={1.8}>
    <ThemeProvider>
      <CantonConnectProvider config={connectConfig}>
        <Tokens>
          <Backend>
            <RouterProvider router={router} />
          </Backend>
        </Tokens>
      </CantonConnectProvider>
    </ThemeProvider>
  </LucideProvider>
)
