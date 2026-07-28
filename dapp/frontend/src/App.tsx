import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/toast'
import { ThemeProvider } from '@/theme/ThemeProvider'
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
