import { ThemeProvider } from '@bootnodedev/canton-dappbooster'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/toast'
import { WalletProvider } from '@/wallet/WalletProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export const App = (): React.JSX.Element => (
  <ThemeProvider>
    <WalletProvider>
      <RouterProvider router={router} />
      <Toaster />
    </WalletProvider>
  </ThemeProvider>
)
